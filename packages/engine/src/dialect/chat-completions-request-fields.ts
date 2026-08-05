import type { ChatCompletionsRequest, ChatSystemMessage, ChatTool } from './chat-completions-wire';
import type { Fate } from './fates';
import type {
  HubCacheBreakpoint,
  HubSampling,
  HubSystemText,
  HubTool,
  HubToolChoice,
  HubToolSchema,
} from './hub';

import { chatCacheControlFrom } from './chat-completions-cache';
import { chatCompletionsDrops } from './chat-completions-drops';

export const injectedMaxOutputTokensDefault = 4096;

function recordTokenSource(request: ChatCompletionsRequest, fates: Fate[]): void {
  if (request.max_completion_tokens !== undefined) {
    fates.push({
      field: 'max_completion_tokens',
      disposition: 'mapped',
      to: 'sampling.maxOutputTokens',
    });

    if (request.max_tokens !== undefined) {
      fates.push({ field: 'max_tokens', disposition: 'mapped', to: 'absent' });
    }

    return;
  }

  if (request.max_tokens !== undefined) {
    fates.push({ field: 'max_tokens', disposition: 'mapped', to: 'sampling.maxOutputTokens' });
  }
}

function maxTokensFrom(request: ChatCompletionsRequest, fates: Fate[]): number {
  const ceiling = request.max_completion_tokens ?? request.max_tokens;

  if (ceiling === undefined) {
    fates.push({
      field: 'max_tokens',
      disposition: 'mapped',
      to: 'sampling.maxOutputTokens (default)',
    });

    return injectedMaxOutputTokensDefault;
  }

  recordTokenSource(request, fates);

  return ceiling;
}

function temperatureInto(
  request: ChatCompletionsRequest,
  sampling: HubSampling,
  fates: Fate[],
): HubSampling {
  if (request.temperature === undefined) {
    return sampling;
  }

  const clamped = Math.min(request.temperature, 1);
  const to =
    clamped === request.temperature ? 'sampling.temperature' : 'sampling.temperature (clamped)';

  fates.push({ field: 'temperature', disposition: 'mapped', to });

  return { ...sampling, temperature: clamped };
}

function topPInto(
  request: ChatCompletionsRequest,
  sampling: HubSampling,
  fates: Fate[],
): HubSampling {
  if (request.top_p === undefined) {
    return sampling;
  }

  fates.push({ field: 'top_p', disposition: 'mapped', to: 'sampling.topP' });

  return { ...sampling, topP: request.top_p };
}

function stopInto(
  request: ChatCompletionsRequest,
  sampling: HubSampling,
  fates: Fate[],
): HubSampling {
  if (request.stop === undefined) {
    return sampling;
  }

  fates.push({ field: 'stop', disposition: 'mapped', to: 'sampling.stop' });

  return { ...sampling, stop: typeof request.stop === 'string' ? [request.stop] : request.stop };
}

export function samplingFrom(request: ChatCompletionsRequest, fates: Fate[]): HubSampling {
  const base: HubSampling = { maxOutputTokens: maxTokensFrom(request, fates) };
  const withTemperature = temperatureInto(request, base, fates);
  const withTopP = topPInto(request, withTemperature, fates);

  return stopInto(request, withTopP, fates);
}

function hasRootSchemaUnion(parameters: ChatTool['function']['parameters']): boolean {
  return parameters.anyOf !== undefined || parameters.oneOf !== undefined;
}

function hubToolSchemaFrom(parameters: ChatTool['function']['parameters']): HubToolSchema {
  if (hasRootSchemaUnion(parameters)) {
    return { type: 'object', properties: {} };
  }

  return {
    type: 'object',
    properties: parameters.properties ?? {},
    ...(parameters.required ? { required: parameters.required } : {}),
  };
}

function hubToolFromChat(tool: ChatTool): HubTool {
  return {
    name: tool.function.name,
    ...(tool.function.description !== undefined ? { description: tool.function.description } : {}),
    inputSchema: hubToolSchemaFrom(tool.function.parameters),
  };
}

export function toolsFrom(
  request: ChatCompletionsRequest,
  fates: Fate[],
): readonly HubTool[] | undefined {
  if (request.tools === undefined) {
    return undefined;
  }

  fates.push({ field: 'tools', disposition: 'carried' });

  if (request.tools.some((tool) => hasRootSchemaUnion(tool.function.parameters))) {
    fates.push({ field: 'tools[schema union]', disposition: 'mapped', to: 'absent' });
  }

  return request.tools.map(hubToolFromChat);
}

function stringToolChoice(choice: 'auto' | 'none' | 'required'): HubToolChoice {
  switch (choice) {
    case 'auto':
      return { type: 'auto' };
    case 'none':
      return { type: 'none' };
    case 'required':
      return { type: 'required' };

    default: {
      const unknownChoice: never = choice;

      throw new Error(`decodeRequest met an unknown tool choice: ${JSON.stringify(unknownChoice)}`);
    }
  }
}

export function toolChoiceFrom(
  request: ChatCompletionsRequest,
  fates: Fate[],
): HubToolChoice | undefined {
  const choice = request.tool_choice;

  if (choice === undefined) {
    return undefined;
  }

  fates.push({ field: 'tool_choice', disposition: 'mapped', to: 'toolChoice' });

  if (typeof choice !== 'string') {
    return { type: 'tool', name: choice.function.name };
  }

  return stringToolChoice(choice);
}

export function scanDrops(request: ChatCompletionsRequest, fates: Fate[]): void {
  for (const drop of chatCompletionsDrops) {
    if (drop.field in request) {
      fates.push({
        field: drop.field,
        disposition: 'mapped',
        to: 'absent',
        ...(drop.costBearing ? { costBearing: true } : {}),
      });
    }
  }
}

export function scanEnvelope(request: ChatCompletionsRequest, fates: Fate[]): void {
  if (request.model !== undefined) {
    fates.push({ field: 'model', disposition: 'carried' });
  }

  fates.push({ field: 'messages', disposition: 'mapped', to: 'messages' });
}

export function systemFrom(
  texts: readonly string[],
  breakpoint?: HubCacheBreakpoint,
): readonly HubSystemText[] | undefined {
  if (texts.length === 0) {
    return undefined;
  }

  const text = texts.join('\n');

  return [{ text, ...(breakpoint === undefined ? {} : { cacheBreakpoint: breakpoint }) }];
}

export function systemMessageFrom(
  system: readonly HubSystemText[] | undefined,
  fates: Fate[],
): ChatSystemMessage | undefined {
  if (system === undefined || system.length === 0) {
    return undefined;
  }

  fates.push({ field: 'system', disposition: 'mapped', to: 'messages[system]' });

  const droppedBreakpoints = system
    .slice(0, -1)
    .filter((text) => text.cacheBreakpoint !== undefined);

  if (droppedBreakpoints.length > 0) {
    fates.push({
      field: 'system[cacheBreakpoint]',
      disposition: 'mapped',
      to: 'absent',
      costBearing: true,
    });
  }

  return {
    role: 'system',
    content: system.map((text) => text.text).join('\n'),
    ...chatCacheControlFrom(system.at(-1)?.cacheBreakpoint),
  };
}
