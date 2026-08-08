import type { GeminiRequest } from './gemini-wire';
import type { HubRequest } from './hub';

import { geminiAdvancedConfigInto } from './gemini-generation-config';

type GenerationConfig = NonNullable<GeminiRequest['generationConfig']>;

function generationConfig(value: GeminiRequest): GenerationConfig {
  value.generationConfig ??= {};

  return value.generationConfig;
}

function reasoningInto(value: GeminiRequest, hub: HubRequest): void {
  if (hub.reasoning === undefined) return;

  const config = generationConfig(value);
  const thinking = config.thinkingConfig ?? {};

  effortInto(thinking, hub.reasoning.effort);
  budgetInto(thinking, hub.reasoning.budgetTokens);
  summaryInto(thinking, hub.reasoning.summary);

  config.thinkingConfig = thinking;
}

function effortInto(
  thinking: NonNullable<GenerationConfig['thinkingConfig']>,
  effort: string | undefined,
): void {
  if (effort !== undefined) thinking.thinkingLevel = effort;
}

function budgetInto(
  thinking: NonNullable<GenerationConfig['thinkingConfig']>,
  budget: number | undefined,
): void {
  if (budget !== undefined) thinking.thinkingBudget = budget;
}

function summaryInto(
  thinking: NonNullable<GenerationConfig['thinkingConfig']>,
  summary: string | undefined,
): void {
  if (summary !== undefined) thinking.includeThoughts = summary !== 'none';
}

function modalitiesInto(value: GeminiRequest, hub: HubRequest): void {
  if (hub.responseModalities === undefined) return;

  generationConfig(value).responseModalities = hub.responseModalities.map((entry) =>
    entry.toUpperCase(),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function schemaIn(format: Record<string, unknown>): unknown {
  const jsonSchema = format['json_schema'];

  if (isRecord(jsonSchema) && jsonSchema['schema'] !== undefined) return jsonSchema['schema'];

  return format['schema'];
}

function formatInto(value: GeminiRequest, hub: HubRequest): void {
  const format = hub.responseFormat;

  if (!isRecord(format)) return;

  const type = format['type'];

  if (type !== 'json_object' && type !== 'json_schema') return;

  const config = generationConfig(value);
  const schema = schemaIn(format);

  delete config.responseSchema;
  delete config.responseJsonSchema;
  delete config['response_schema'];
  delete config['response_json_schema'];

  config.responseMimeType = 'application/json';
  if (schema !== undefined) config.responseJsonSchema = schema;
}

function serviceInto(value: GeminiRequest, hub: HubRequest): void {
  if (hub.serviceTier !== undefined) value.service_tier = hub.serviceTier;
}

export function geminiOptionsInto(value: GeminiRequest, hub: HubRequest): void {
  geminiAdvancedConfigInto(value, hub);
  reasoningInto(value, hub);
  modalitiesInto(value, hub);
  formatInto(value, hub);
  serviceInto(value, hub);
}
