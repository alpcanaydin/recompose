import type { GeminiRequest } from './gemini-wire';
import type { HubRequest } from './hub';
import type { InteractionsRequest } from './interactions-wire';

import { isRawJsonValue } from '../json-precise';

const mappedFields = new Set([
  'max_output_tokens',
  'temperature',
  'top_p',
  'stop_sequences',
  'tool_choice',
  'thinking_level',
  'thinking_budget',
  'thinking_summaries',
]);

export function geminiConfigFromInteractions(
  request: InteractionsRequest,
): Pick<HubRequest, 'geminiGenerationConfig'> | object {
  const config = request.generation_config;

  if (config === undefined) return {};

  const entries = Object.entries(config).filter(([key]) => !mappedFields.has(key));

  return entries.length === 0 ? {} : { geminiGenerationConfig: Object.fromEntries(entries) };
}

export function geminiConfigIntoInteractions(value: InteractionsRequest, hub: HubRequest): void {
  if (hub.geminiGenerationConfig === undefined) return;

  value.generation_config = {
    ...hub.geminiGenerationConfig,
    ...value.generation_config,
  };
}

function camelKey(key: string): string {
  return key.replace(/_([a-z])/gu, (_match, letter: string) => letter.toUpperCase());
}

function camelized(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelized);
  if (isRawJsonValue(value)) return value;
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, member]) => [camelKey(key), camelized(member)]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function geminiAdvancedConfigInto(value: GeminiRequest, hub: HubRequest): void {
  if (hub.geminiGenerationConfig === undefined) return;

  const config = camelized(hub.geminiGenerationConfig);

  if (!isRecord(config)) return;

  value.generationConfig = { ...value.generationConfig, ...config };
}
