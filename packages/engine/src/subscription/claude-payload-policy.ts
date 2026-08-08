import type { JsonObject } from '../gateway-wire';
import type { ClaudeSystemPolicy } from './claude-system-policy';

import { isJsonObject } from '../gateway-wire';

type ClaudePayloadRule = {
  models?: readonly string[];
  values: JsonObject;
};

type ClaudePayloadFilter = {
  models?: readonly string[];
  paths: readonly string[];
};

export type ClaudePayloadPolicy = {
  mode?: 'always' | 'never';
  strictMode?: boolean;
  sensitiveWords?: readonly string[];
  overrides?: readonly ClaudePayloadRule[];
  filters?: readonly ClaudePayloadFilter[];
};

export function payloadSystemPolicy(
  systemPolicy: ClaudeSystemPolicy | undefined,
  payloadPolicy: ClaudePayloadPolicy | undefined,
): ClaudeSystemPolicy | undefined {
  if (!active(payloadPolicy) || payloadPolicy.strictMode !== true) return systemPolicy;

  return { ...systemPolicy, strictMode: true };
}

export function applyClaudePayloadOverrides(
  body: JsonObject,
  policy: ClaudePayloadPolicy | undefined,
): JsonObject {
  if (!active(policy)) return body;

  const updated = structuredClone(body);

  for (const rule of policy.overrides ?? []) {
    if (matchesBody(rule.models, body)) applyValues(updated, rule.values);
  }

  return updated;
}

export function applyClaudePayloadFinalPolicy(
  body: JsonObject,
  policy: ClaudePayloadPolicy | undefined,
): JsonObject {
  if (!active(policy)) return body;

  const filtered = filteredBody(body, policy.filters ?? []);

  return obfuscatedBody(filtered, policy.sensitiveWords ?? []);
}

function filteredBody(body: JsonObject, filters: readonly ClaudePayloadFilter[]): JsonObject {
  const filtered = structuredClone(body);

  for (const rule of filters) {
    if (matchesBody(rule.models, body)) deletePaths(filtered, rule.paths);
  }

  return filtered;
}

function active(policy: ClaudePayloadPolicy | undefined): policy is ClaudePayloadPolicy {
  return policy !== undefined && policy.mode !== 'never';
}

function matchesBody(models: readonly string[] | undefined, body: JsonObject): boolean {
  if (models === undefined || models.length === 0) return true;

  const model = typeof body['model'] === 'string' ? body['model'] : '';

  return models.some((pattern) => modelMatches(pattern, model));
}

function modelMatches(pattern: string, model: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/gu, '\\$&').replaceAll('*', '.*');

  return new RegExp(`^${escaped}$`, 'u').test(model);
}

function applyValues(body: JsonObject, values: JsonObject): void {
  for (const [path, value] of Object.entries(values)) setPath(body, path, value);
}

function setPath(body: JsonObject, path: string, value: unknown): void {
  const parts = path.split('.').filter((part) => part !== '');
  const leaf = parts.pop();

  if (leaf === undefined) return;

  let target = body;

  for (const part of parts) target = childObject(target, part);
  target[leaf] = structuredClone(value);
}

function childObject(parent: JsonObject, key: string): JsonObject {
  const existing = parent[key];

  if (isJsonObject(existing)) return existing;

  const created: JsonObject = {};

  parent[key] = created;

  return created;
}

function deletePaths(body: JsonObject, paths: readonly string[]): void {
  for (const path of paths) deletePath(body, path);
}

function deletePath(body: JsonObject, path: string): void {
  const parts = path.split('.').filter((part) => part !== '');
  const leaf = parts.pop();

  if (leaf === undefined) return;

  let target: JsonObject | null = body;

  for (const part of parts) target = target === null ? null : objectChild(target, part);
  if (target !== null) delete target[leaf];
}

function objectChild(parent: JsonObject, key: string): JsonObject | null {
  const child = parent[key];

  return isJsonObject(child) ? child : null;
}

function obfuscatedBody(body: JsonObject, words: readonly string[]): JsonObject {
  if (words.length === 0) return body;

  const cloned = structuredClone(body);

  cloned['system'] = obfuscatedSystem(cloned['system'], words);
  cloned['messages'] = obfuscatedMessages(cloned['messages'], words);

  return cloned;
}

function obfuscatedSystem(value: unknown, words: readonly string[]): unknown {
  if (typeof value === 'string') return obfuscatedText(value, words);
  if (!Array.isArray(value)) return value;

  return value.map((block) => obfuscatedBlock(block, words));
}

function obfuscatedMessages(value: unknown, words: readonly string[]): unknown {
  if (!Array.isArray(value)) return value;

  return value.map((message) => obfuscatedMessage(message, words));
}

function obfuscatedMessage(value: unknown, words: readonly string[]): unknown {
  if (!isJsonObject(value)) return value;

  if (typeof value['content'] === 'string') {
    return { ...value, content: obfuscatedText(value['content'], words) };
  }

  if (!Array.isArray(value['content'])) return value;

  const content = value['content'].map((block) => obfuscatedBlock(block, words));

  return { ...value, content };
}

function obfuscatedBlock(block: unknown, words: readonly string[]): unknown {
  if (!isJsonObject(block) || block['type'] !== 'text') return block;

  const text = block['text'];

  return typeof text === 'string' ? { ...block, text: obfuscatedText(text, words) } : block;
}

function obfuscatedText(text: string, words: readonly string[]): string {
  return words.reduce((result, word) => obfuscatedWord(result, word), text);
}

function obfuscatedWord(text: string, word: string): string {
  if (word.length < 2) return text;

  const pattern = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'giu');

  return text.replace(pattern, (match) => `${match[0]}\u200B${match.slice(1)}`);
}
