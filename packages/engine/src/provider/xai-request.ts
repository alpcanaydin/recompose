import type { Crossing, JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';
import { normalizeXAIInput } from './xai-input';
import { normalizeXAITools } from './xai-tools';

function additionalTools(input: unknown): boolean {
  if (!Array.isArray(input)) return false;

  return input.some(
    (item) =>
      isJsonObject(item) &&
      item['type'] === 'additional_tools' &&
      Array.isArray(item['tools']) &&
      item['tools'].length > 0,
  );
}

function hasTools(body: JsonObject): boolean {
  const tools = body['tools'];

  return (Array.isArray(tools) && tools.length > 0) || additionalTools(body['input']);
}

function hasToolControls(body: JsonObject): boolean {
  return 'tools' in body || 'tool_choice' in body || 'parallel_tool_calls' in body;
}

export function normalizeXAIToolChoice(body: JsonObject): JsonObject {
  if (hasTools(body)) return body;
  if (!hasToolControls(body)) return body;

  const { tools: _tools, tool_choice: _choice, parallel_tool_calls: _parallel, ...rest } = body;

  return rest;
}

export function xaiProviderBody(body: JsonObject, crossing: Crossing): JsonObject {
  const withInput = normalizeXAIInput(body);
  const withTools = normalizeXAITools(withInput);
  const normalized = normalizeXAIToolChoice(withTools);
  const { stop: _stop, ...withoutStop } = normalized;

  return {
    ...withoutStop,
    model: crossing.providerModel,
    stream: true,
    ...(crossing.sessionId === undefined ? {} : { prompt_cache_key: crossing.sessionId }),
  };
}
