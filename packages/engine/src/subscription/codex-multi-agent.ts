import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';

const COLLABORATION = 'collaboration';
const OPTIMIZED_COLLABORATION = 'collaboration-optimize';
const MODEL_HEADING = 'Available model overrides (optional; inherited parent model is preferred):';
const DESCRIPTION_MARKER = 'Spawns an agent.';
const MESSAGE_TOOLS = new Set(['spawn_agent', 'send_message', 'followup_task']);

type CodexAgentModel = {
  id: string;
  description?: string;
  reasoningEfforts?: readonly string[];
  defaultReasoningEffort?: string;
  serviceTiers?: readonly string[];
};

export type CodexMultiAgentOptions = {
  enabled?: boolean;
  userAgent?: string;
  models?: readonly CodexAgentModel[];
};

function sentence(value: string): string {
  return /[.!?]$/u.test(value) ? value : `${value}.`;
}

function reasoningDetail(model: CodexAgentModel): string | undefined {
  const efforts = model.reasoningEfforts?.map((effort) =>
    effort === model.defaultReasoningEffort ? `${effort} (default)` : effort,
  );

  return efforts === undefined || efforts.length === 0
    ? undefined
    : `Reasoning efforts: ${efforts.join(', ')}.`;
}

function serviceTierDetail(model: CodexAgentModel): string | undefined {
  return model.serviceTiers === undefined || model.serviceTiers.length === 0
    ? undefined
    : `Service tiers: ${model.serviceTiers.join(', ')}.`;
}

function modelLine(model: CodexAgentModel): string {
  const details = [
    sentence(model.description ?? 'Resolved gateway target'),
    reasoningDetail(model),
    serviceTierDetail(model),
  ].filter((detail): detail is string => detail !== undefined);

  return `- \`${model.id}\`: ${details.join(' ')}`;
}

function withoutModelSections(description: string): string {
  const escaped = MODEL_HEADING.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const section = new RegExp(`^[ \\t]*${escaped}(?:\\n(?:[ \\t]*- .*(?:\\n|$))*)?`, 'gmu');

  return description.replace(section, '');
}

function rewrittenDescription(value: unknown, models: readonly CodexAgentModel[]): unknown {
  if (typeof value !== 'string' || models.length === 0) return value;

  const cleaned = withoutModelSections(value);
  const section = `${MODEL_HEADING}\n${models.map(modelLine).join('\n')}\n`;
  const marker = cleaned.indexOf(DESCRIPTION_MARKER.slice(0, -1));

  if (marker < 0) return `${cleaned.replace(/\n+$/u, '')}\n\n${section.trimEnd()}`;

  const lineStart = cleaned.lastIndexOf('\n', marker) + 1;

  return `${cleaned.slice(0, lineStart)}${section}${cleaned.slice(lineStart)}`;
}

function withoutEncryptedMessage(parameters: unknown): unknown {
  if (!isJsonObject(parameters) || !isJsonObject(parameters['properties'])) return parameters;

  const properties = parameters['properties'];
  const message = properties['message'];

  if (!isJsonObject(message)) return parameters;

  const { encrypted: _encrypted, ...plainMessage } = message;

  return { ...parameters, properties: { ...properties, message: plainMessage } };
}

function optimizedFunction(tool: JsonObject, models: readonly CodexAgentModel[]): JsonObject {
  const name = tool['name'];

  if (typeof name !== 'string' || !MESSAGE_TOOLS.has(name)) return tool;

  return {
    ...tool,
    ...(name === 'spawn_agent'
      ? { description: rewrittenDescription(tool['description'], models) }
      : {}),
    parameters: withoutEncryptedMessage(tool['parameters']),
  };
}

function includesSpawnAgent(tools: readonly unknown[]): boolean {
  return tools.some(
    (tool) => isJsonObject(tool) && tool['type'] === 'function' && tool['name'] === 'spawn_agent',
  );
}

function optimizedTool(
  value: unknown,
  models: readonly CodexAgentModel[],
  rename: boolean,
): unknown {
  if (!isJsonObject(value)) return value;

  return optimizedToolObject(value, models, rename);
}

function optimizedToolObject(
  value: JsonObject,
  models: readonly CodexAgentModel[],
  rename: boolean,
): JsonObject {
  if (value['type'] === 'function') return optimizedFunction(value, models);
  if (value['type'] !== 'namespace' || !Array.isArray(value['tools'])) return value;

  return optimizedNamespace(value, models, rename);
}

function optimizedNamespace(
  value: JsonObject,
  models: readonly CodexAgentModel[],
  rename: boolean,
): JsonObject {
  const sourceTools = value['tools'];

  if (!Array.isArray(sourceTools)) return value;

  const tools = sourceTools.map((tool) => optimizedTool(tool, models, false));
  const name =
    rename && value['name'] === COLLABORATION && includesSpawnAgent(tools)
      ? OPTIMIZED_COLLABORATION
      : value['name'];

  return { ...value, name, tools };
}

function hasOptimizedNamespace(tools: readonly unknown[]): boolean {
  return tools.some((tool) => isJsonObject(tool) && tool['name'] === OPTIMIZED_COLLABORATION);
}

function optimizedTools(value: unknown, models: readonly CodexAgentModel[]): unknown {
  if (!Array.isArray(value)) return value;

  const rename = models.length > 0 && !hasOptimizedNamespace(value);

  return value.map((tool) => optimizedTool(tool, models, rename));
}

function readableAgentPart(value: unknown): unknown {
  if (!isJsonObject(value) || value['type'] !== 'encrypted_content') return value;

  const encrypted = value['encrypted_content'];

  return typeof encrypted === 'string' ? { type: 'input_text', text: encrypted } : value;
}

function optimizedInputItem(value: unknown, models: readonly CodexAgentModel[]): unknown {
  if (!isJsonObject(value)) return value;

  if (value['type'] === 'additional_tools') {
    return { ...value, tools: optimizedTools(value['tools'], models) };
  }

  return value['type'] === 'agent_message' && Array.isArray(value['content'])
    ? { ...value, content: value['content'].map(readableAgentPart) }
    : value;
}

function isCodexMultiAgentClient(userAgent: string): boolean {
  const value = userAgent.trim();

  return (
    value.startsWith('Codex Desktop/') ||
    value.startsWith('codex-tui/') ||
    value === 'codex_cli_rs' ||
    value.startsWith('codex_cli_rs/')
  );
}

function modelsFor(body: JsonObject, options: CodexMultiAgentOptions): readonly CodexAgentModel[] {
  const model = typeof body['model'] === 'string' ? body['model'] : '';

  return options.models ?? (model === '' ? [] : [{ id: model }]);
}

function optimizationEnabled(options: CodexMultiAgentOptions): boolean {
  return (options.enabled ?? true) && isCodexMultiAgentClient(options.userAgent ?? 'codex-tui/0');
}

function optimizedInput(value: unknown, models: readonly CodexAgentModel[]): unknown {
  return Array.isArray(value) ? value.map((item) => optimizedInputItem(item, models)) : value;
}

export function optimizeCodexMultiAgent(
  body: JsonObject,
  options: CodexMultiAgentOptions = {},
): JsonObject {
  if (!optimizationEnabled(options)) return body;

  const models = modelsFor(body, options);

  return {
    ...body,
    tools: optimizedTools(body['tools'], models),
    input: optimizedInput(body['input'], models),
  };
}

export function restoreCodexMultiAgentValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(restoreCodexMultiAgentValue);
  if (!isJsonObject(value)) return value;

  const restored = Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, restoreCodexMultiAgentValue(entry)]),
  );
  const toolCall = ['function_call', 'custom_tool_call'].includes(String(restored['type']));

  return toolCall && restored['namespace'] === OPTIMIZED_COLLABORATION
    ? { ...restored, namespace: COLLABORATION }
    : restored;
}
