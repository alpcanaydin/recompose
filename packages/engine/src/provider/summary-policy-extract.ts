import type { JsonObject } from '../gateway-wire';
import type { SummaryConfig, SummaryFormat } from './summary-policy-types';

import { isJsonObject } from '../gateway-wire';
import { activeClaudeThinking } from './summary-policy-claude';

const unspecified: SummaryConfig = { mode: 'unspecified' };

function atPath(body: JsonObject, path: string): unknown {
  let current: unknown = body;

  for (const key of path.split('.')) {
    if (!isJsonObject(current)) return undefined;

    current = current[key];
  }

  return current;
}

function booleanConfig(value: unknown, invert = false): SummaryConfig | undefined {
  if (typeof value !== 'boolean') return undefined;

  const enabled = invert ? !value : value;

  return enabled ? { mode: 'enabled', detail: 'auto' } : { mode: 'disabled' };
}

function firstBoolean(
  body: JsonObject,
  paths: readonly string[],
  invert = false,
): SummaryConfig | undefined {
  for (const path of paths) {
    const config = booleanConfig(atPath(body, path), invert);

    if (config !== undefined) return config;
  }

  return undefined;
}

function stringConfig(value: unknown): SummaryConfig | undefined {
  if (value === null) return { mode: 'disabled' };
  if (typeof value !== 'string') return undefined;

  const detail = value.trim().toLowerCase();

  return detailConfig(detail);
}

function detailConfig(detail: string): SummaryConfig | undefined {
  if (detail === '') return undefined;
  if (['none', 'omitted'].includes(detail)) return { mode: 'disabled' };

  return { mode: 'enabled', detail };
}

function chatExplicit(body: JsonObject): SummaryConfig | undefined {
  return (
    firstBoolean(body, ['extra_body.google.thinking_config.include_thoughts']) ??
    firstBoolean(body, ['reasoning.exclude'], true) ??
    firstBoolean(body, [
      'thinking.includeThoughts',
      'thinking.include_thoughts',
      'generationConfig.thinkingConfig.includeThoughts',
      'generationConfig.thinkingConfig.include_thoughts',
    ]) ??
    firstBoolean(body, ['include_reasoning']) ??
    firstBoolean(body, ['reasoning.enabled'])
  );
}

function chatConfig(body: JsonObject, explicitOnly: boolean): SummaryConfig {
  const explicit = chatExplicit(body);

  if (explicit !== undefined) return explicit;
  if (explicitOnly) return unspecified;

  return inferredChatConfig(body['reasoning_effort']);
}

function inferredChatConfig(effort: unknown): SummaryConfig {
  if (typeof effort !== 'string' || effort.trim() === '') return unspecified;

  return effort.trim().toLowerCase() === 'none'
    ? { mode: 'disabled' }
    : { mode: 'enabled', detail: 'auto' };
}

function responsesConfig(body: JsonObject): SummaryConfig {
  return (
    stringConfig(atPath(body, 'reasoning.summary')) ??
    stringConfig(atPath(body, 'reasoning.generate_summary')) ??
    unspecified
  );
}

function claudeConfig(body: JsonObject): SummaryConfig {
  if (!activeClaudeThinking(body)) return unspecified;

  return stringConfig(atPath(body, 'thinking.display')) ?? unspecified;
}

function geminiConfig(body: JsonObject, prefix: string): SummaryConfig {
  return (
    firstBoolean(body, [
      `${prefix}thinkingConfig.includeThoughts`,
      `${prefix}thinkingConfig.include_thoughts`,
      `${prefix}thinking_config.includeThoughts`,
      `${prefix}thinking_config.include_thoughts`,
    ]) ?? unspecified
  );
}

function interactionsConfig(body: JsonObject): SummaryConfig {
  const summary =
    stringConfig(atPath(body, 'generation_config.thinking_summaries')) ??
    stringConfig(atPath(body, 'generation_config.thinkingSummaries')) ??
    stringConfig(atPath(body, 'reasoning.summary'));

  return (
    summary ??
    firstBoolean(body, [
      'generation_config.thinking_config.include_thoughts',
      'generation_config.thinking_config.includeThoughts',
      'generation_config.thinkingConfig.include_thoughts',
      'generation_config.thinkingConfig.includeThoughts',
    ]) ??
    unspecified
  );
}

type SummaryExtractor = (body: JsonObject, explicitOnly: boolean) => SummaryConfig;

const extractors: Record<SummaryFormat, SummaryExtractor> = {
  'chat-completions': chatConfig,
  responses: (body) => responsesConfig(body),
  anthropic: (body) => claudeConfig(body),
  gemini: (body) => geminiConfig(body, 'generationConfig.'),
  antigravity: (body) => geminiConfig(body, 'request.generationConfig.'),
  interactions: (body) => interactionsConfig(body),
};

export function extractSummaryConfig(
  body: JsonObject,
  format: SummaryFormat,
  explicitOnly = false,
): SummaryConfig {
  return extractors[format](body, explicitOnly);
}
