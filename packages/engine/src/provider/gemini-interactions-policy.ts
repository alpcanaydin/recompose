import type { Crossing, JsonObject, ProxyDialect } from '../gateway-wire';

import { isJsonObject, parsedJson } from '../gateway-wire';
import { applyReasoningCapabilities } from './reasoning-capabilities';

const DEFAULT_INTERACTIONS_API_REVISION = '2026-05-20';

type PayloadRule = { models: unknown[]; params: JsonObject };
type PayloadPolicy = { defaults: PayloadRule[]; overrides: PayloadRule[] };

export type GeminiInteractionsCredential = {
  apiKey: string;
  apiRevision?: string;
  payload: PayloadPolicy;
};

const emptyPolicy: PayloadPolicy = { defaults: [], overrides: [] };
const interactionsCapabilities = {
  dynamicAllowed: true,
  levels: ['none', 'minimal', 'low', 'medium', 'high'],
  zeroAllowed: true,
} as const;

function stringMember(value: JsonObject, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const member = value[key];

    if (typeof member === 'string' && member.trim() !== '') return member.trim();
  }

  return undefined;
}

function rulesOf(value: unknown): PayloadRule[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!isJsonObject(entry) || !Array.isArray(entry['models']) || !isJsonObject(entry['params'])) {
      return [];
    }

    return [{ models: entry['models'], params: entry['params'] }];
  });
}

function payloadPolicy(value: unknown): PayloadPolicy {
  if (!isJsonObject(value)) return emptyPolicy;

  return {
    defaults: rulesOf(value['defaults'] ?? value['default']),
    overrides: rulesOf(value['overrides'] ?? value['override']),
  };
}

export function parseGeminiInteractionsCredential(raw: string): GeminiInteractionsCredential {
  const value = parsedJson(raw);

  if (!isJsonObject(value)) return { apiKey: raw, payload: emptyPolicy };

  const apiKey = stringMember(value, 'api_key', 'apiKey');

  if (apiKey === undefined) return { apiKey: raw, payload: emptyPolicy };

  const apiRevision = stringMember(value, 'api_revision', 'apiRevision');

  return {
    apiKey,
    ...(apiRevision === undefined ? {} : { apiRevision }),
    payload: payloadPolicy(value['payload']),
  };
}

function sourceProtocol(dialect: ProxyDialect): string {
  if (dialect === 'chat-completions') return 'openai';
  if (dialect === 'responses') return 'responses';
  if (dialect === 'anthropic') return 'claude';

  return dialect;
}

function matchesModel(value: unknown, model: string, fromProtocol: string): boolean {
  if (!isJsonObject(value)) return false;

  return (
    value['name'] === model &&
    value['protocol'] === 'interactions' &&
    value['fromProtocol'] === fromProtocol
  );
}

function matchingRules(
  rules: readonly PayloadRule[],
  model: string,
  fromProtocol: string,
): PayloadRule[] {
  return rules.filter((rule) =>
    rule.models.some((entry) => matchesModel(entry, model, fromProtocol)),
  );
}

function hasPath(body: JsonObject, path: string): boolean {
  let current: unknown = body;

  for (const key of path.split('.')) {
    if (!isJsonObject(current) || !(key in current)) return false;

    current = current[key];
  }

  return true;
}

function setPath(body: JsonObject, path: string, value: unknown): void {
  const keys = path.split('.');
  let current = body;

  for (const key of keys.slice(0, -1)) {
    const nested = current[key];
    const next = isJsonObject(nested) ? nested : {};

    current[key] = next;
    current = next;
  }

  const last = keys.at(-1);

  if (last !== undefined) current[last] = structuredClone(value);
}

function applyRules(body: JsonObject, rules: readonly PayloadRule[], defaults: boolean): void {
  for (const rule of rules) {
    for (const [path, value] of Object.entries(rule.params)) {
      if (!defaults || !hasPath(body, path)) setPath(body, path, value);
    }
  }
}

function modelField(body: JsonObject, model: string): JsonObject {
  return 'model' in body ? { ...body, model } : body;
}

export function geminiInteractionsBody(
  crossing: Crossing,
  body: JsonObject,
  credential: GeminiInteractionsCredential,
): JsonObject {
  const applied = applyReasoningCapabilities({
    body,
    capabilities: interactionsCapabilities,
    model: crossing.providerModel,
    source: crossing.raw,
    sourceDialect: crossing.dialect,
    strict: false,
    targetDialect: 'interactions',
  });
  const result = structuredClone(modelField(applied.body, applied.model));
  const protocol = sourceProtocol(crossing.dialect);

  applyRules(result, matchingRules(credential.payload.defaults, applied.model, protocol), true);
  applyRules(result, matchingRules(credential.payload.overrides, applied.model, protocol), false);

  return result;
}

export function geminiInteractionsHeaders(
  credential: GeminiInteractionsCredential,
  requestRevision: string | undefined,
): Record<string, string> {
  return {
    'x-goog-api-key': credential.apiKey,
    'api-revision': credential.apiRevision ?? requestRevision ?? DEFAULT_INTERACTIONS_API_REVISION,
  };
}
