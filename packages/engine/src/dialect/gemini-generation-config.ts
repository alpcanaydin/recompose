import type { GeminiRequest } from './gemini-wire';
import type { HubRequest } from './hub';

import { isRawJsonValue } from '../json-precise';

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
