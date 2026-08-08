import type { JsonObject } from '../gateway-wire';
import type { SummaryConfig, SummaryFormat, SummaryPolicyOptions } from './summary-policy-types';

import { isJsonObject } from '../gateway-wire';
import { activeClaudeThinking, enabledClaudeThinking } from './summary-policy-claude';

export type SummaryPolicyResult = {
  body: JsonObject;
  inferredClaudeThinking: boolean;
};

function chatBody(body: JsonObject, enabled: boolean, provider: string | undefined): JsonObject {
  const reasoning = isJsonObject(body['reasoning']) ? body['reasoning'] : {};
  const nextReasoning = chatReasoning(reasoning, enabled, provider);

  return {
    ...body,
    ...(Object.keys(nextReasoning).length === 0 ? {} : { reasoning: nextReasoning }),
    ...('include_reasoning' in body ? { include_reasoning: enabled } : {}),
  };
}

function chatReasoning(
  reasoning: JsonObject,
  enabled: boolean,
  provider: string | undefined,
): JsonObject {
  const existing = 'exclude' in reasoning;
  const openRouter = provider?.toLowerCase().includes('openrouter') === true;

  return existing || openRouter ? { ...reasoning, exclude: !enabled } : reasoning;
}

function claudeBody(
  body: JsonObject,
  config: SummaryConfig,
  options: SummaryPolicyOptions,
): SummaryPolicyResult {
  if (config.mode === 'unspecified') return unspecifiedClaudeBody(body, options);

  const active = activeClaudeThinking(body);

  return configuredClaudeBody(body, config, options, active);
}

function configuredClaudeBody(
  body: JsonObject,
  config: SummaryConfig,
  options: SummaryPolicyOptions,
  active: boolean,
): SummaryPolicyResult {
  if (inactiveDisabled(active, config)) return { body, inferredClaudeThinking: false };

  const thinking = selectedClaudeThinking(body, active, options.model);

  return {
    body: {
      ...body,
      thinking: {
        ...(isJsonObject(thinking) ? thinking : {}),
        display: summaryDisplay(config),
      },
    },
    inferredClaudeThinking: inferredClaudeState(active, options),
  };
}

function inactiveDisabled(active: boolean, config: SummaryConfig): boolean {
  return !active && config.mode === 'disabled';
}

function selectedClaudeThinking(
  body: JsonObject,
  active: boolean,
  model: string | undefined,
): unknown {
  return active ? body['thinking'] : enabledClaudeThinking(model);
}

function summaryDisplay(config: SummaryConfig): 'omitted' | 'summarized' {
  return config.mode === 'enabled' ? 'summarized' : 'omitted';
}

function inferredClaudeState(active: boolean, options: SummaryPolicyOptions): boolean {
  return !active || options.inferredClaudeThinking === true;
}

function unspecifiedClaudeBody(
  body: JsonObject,
  options: SummaryPolicyOptions,
): SummaryPolicyResult {
  if (options.inferredClaudeThinking !== true) {
    return { body, inferredClaudeThinking: false };
  }

  const { thinking: _thinking, ...withoutThinking } = body;

  return { body: withoutThinking, inferredClaudeThinking: false };
}

function generationConfig(body: JsonObject): JsonObject {
  const camel = body['generationConfig'];
  const snake = body['generation_config'];

  return {
    ...(isJsonObject(snake) ? snake : {}),
    ...(isJsonObject(camel) ? camel : {}),
  };
}

function thinkingConfig(generation: JsonObject): JsonObject {
  const camel = generation['thinkingConfig'];
  const snake = generation['thinking_config'];

  if (isJsonObject(camel)) return camel;

  return isJsonObject(snake) ? snake : {};
}

function geminiBody(body: JsonObject, enabled: boolean): JsonObject {
  const generation = generationConfig(body);
  const thinking = thinkingConfig(generation);
  const { includeThoughts: _camel, include_thoughts: _snake, ...restThinking } = thinking;
  const { generation_config: _generationSnake, ...restBody } = body;

  return {
    ...restBody,
    generationConfig: {
      ...generation,
      thinkingConfig: { ...restThinking, includeThoughts: enabled },
    },
  };
}

function antigravityBody(body: JsonObject, enabled: boolean): JsonObject {
  const request = isJsonObject(body['request']) ? body['request'] : {};
  const updated = geminiBody(request, enabled);

  return { ...body, request: updated };
}

function interactionsBody(body: JsonObject, enabled: boolean): JsonObject {
  const config = isJsonObject(body['generation_config']) ? body['generation_config'] : {};
  const { thinkingSummaries: _alias, ...rest } = config;

  return {
    ...body,
    generation_config: { ...rest, thinking_summaries: enabled ? 'auto' : 'none' },
  };
}

function responsesBody(body: JsonObject, config: SummaryConfig): JsonObject {
  const reasoning = isJsonObject(body['reasoning']) ? body['reasoning'] : {};
  const { generate_summary: _deprecated, summary: _summary, ...rest } = reasoning;

  if (config.mode === 'disabled') return disabledResponsesBody(body, rest);

  const detail = ['concise', 'detailed'].includes(config.detail ?? '') ? config.detail : 'auto';

  return { ...body, reasoning: { ...rest, summary: detail } };
}

function disabledResponsesBody(body: JsonObject, reasoning: JsonObject): JsonObject {
  if (Object.keys(reasoning).length > 0) return { ...body, reasoning };

  const { reasoning: _reasoning, ...withoutReasoning } = body;

  return withoutReasoning;
}

export function applySummaryPolicy(
  body: JsonObject,
  format: SummaryFormat,
  config: SummaryConfig,
  options: SummaryPolicyOptions = {},
): SummaryPolicyResult {
  if (format === 'anthropic') return claudeBody(body, config, options);
  if (config.mode === 'unspecified') return { body, inferredClaudeThinking: false };

  const enabled = config.mode === 'enabled';
  const applied = appliedNonClaude(body, format, config, enabled, options.provider);

  return { body: applied, inferredClaudeThinking: false };
}

function appliedNonClaude(
  body: JsonObject,
  format: Exclude<SummaryFormat, 'anthropic'>,
  config: SummaryConfig,
  enabled: boolean,
  provider: string | undefined,
): JsonObject {
  if (format === 'chat-completions') return chatBody(body, enabled, provider);
  if (format === 'gemini') return geminiBody(body, enabled);
  if (format === 'antigravity') return antigravityBody(body, enabled);
  if (format === 'interactions') return interactionsBody(body, enabled);

  return responsesBody(body, config);
}
