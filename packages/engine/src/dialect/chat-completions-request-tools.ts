import type { ChatCompletionsRequest, ChatTool } from './chat-completions-wire';
import type { Fate } from './fates';
import type { HubJsonObject, HubTool, HubToolChoice, HubToolSchema } from './hub';

import { hubBreakpointFrom } from './chat-completions-cache';
import { hubToolSchemaFrom as normalizedToolSchema } from './tool-schema';

function hasUnion(parameters: ChatTool['function']['parameters']): boolean {
  return parameters.anyOf !== undefined || parameters.oneOf !== undefined;
}

function isObject(value: unknown): value is HubJsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function schema(parameters: ChatTool['function']['parameters']): HubToolSchema {
  if (!hasUnion(parameters)) return normalizedToolSchema(parameters);

  return { type: 'object', properties: mergedProperties(parameters) };
}

function mergedProperties(parameters: ChatTool['function']['parameters']): HubJsonObject {
  const properties: Record<string, unknown> = { ...parameters.properties };

  for (const branch of parameters.anyOf ?? parameters.oneOf ?? []) mergeBranch(properties, branch);

  return properties;
}

function mergeBranch(properties: Record<string, unknown>, branch: unknown): void {
  if (isObject(branch) && isObject(branch['properties']))
    Object.assign(properties, branch['properties']);
}

function toolOf(tool: NonNullable<ChatCompletionsRequest['tools']>[number]): HubTool {
  if (tool.type === 'custom')
    return {
      name: tool.name,
      ...(tool.description === undefined ? {} : { description: tool.description }),
      inputSchema: { type: 'object', properties: {} },
      family: 'custom',
    };
  const cacheBreakpoint = hubBreakpointFrom(tool.cache_control);

  return {
    name: String(tool.function.name),
    ...(tool.function.description === undefined ? {} : { description: tool.function.description }),
    inputSchema: schema(tool.function.parameters),
    ...(cacheBreakpoint === undefined ? {} : { cacheBreakpoint }),
  };
}

export function toolsFrom(
  request: ChatCompletionsRequest,
  fates: Fate[],
): readonly HubTool[] | undefined {
  if (request.tools === undefined) return undefined;
  fates.push({ field: 'tools', disposition: 'carried' });
  if (request.tools.some((tool) => tool.type === 'function' && hasUnion(tool.function.parameters)))
    fates.push({ field: 'tools[schema union]', disposition: 'mapped', to: 'absent' });

  return request.tools.map(toolOf);
}

function namedChoice(
  request: ChatCompletionsRequest,
  choice: Exclude<NonNullable<ChatCompletionsRequest['tool_choice']>, string>,
): HubToolChoice {
  if (choice.type === 'custom') return { type: 'tool', name: choice.name, family: 'custom' };
  const name = choice.function.name;
  const tools = request.tools ?? [];
  const hasFunction = tools.some(
    (tool) => tool.type === 'function' && String(tool.function.name) === name,
  );
  const hasCustom = tools.some((tool) => tool.type === 'custom' && tool.name === name);

  return !hasFunction && hasCustom
    ? { type: 'tool', name, family: 'custom' }
    : { type: 'tool', name };
}

export function toolChoiceFrom(
  request: ChatCompletionsRequest,
  fates: Fate[],
): HubToolChoice | undefined {
  const choice = request.tool_choice;

  if (choice === undefined) return undefined;
  fates.push({ field: 'tool_choice', disposition: 'mapped', to: 'toolChoice' });
  if (typeof choice !== 'string') return namedChoice(request, choice);
  if (choice === 'auto') return { type: 'auto' };
  if (choice === 'none') return { type: 'none' };

  return { type: 'required' };
}
