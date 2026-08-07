import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';
import { canonicalJson } from '../subscription/canonical-json';
import { normalizeKimiUpstreamModel } from './kimi-request';

type ReplayInjection = { body: JsonObject; applied: boolean };

function modelWithoutSuffix(model: string): string {
  return model.trim().replace(/\([^()]*\)\s*$/u, '');
}

export function kimiThinkingReplayModelFamily(model: string): string {
  const normalized = normalizeKimiUpstreamModel(modelWithoutSuffix(model));

  return normalized === 'k3' || normalized === 'k3-256k' ? 'k3' : normalized;
}

function contentParts(value: unknown): JsonObject[] | null {
  return Array.isArray(value) && value.every(isJsonObject) ? value : null;
}

function hasThinking(parts: readonly JsonObject[]): boolean {
  return parts.some((part) => part['type'] === 'thinking' || part['type'] === 'redacted_thinking');
}

function nonThinkingParts(value: unknown): JsonObject[] | null {
  const parts = contentParts(value);

  if (parts === null) return null;

  const filtered = parts.filter(
    (part) => part['type'] !== 'thinking' && part['type'] !== 'redacted_thinking',
  );
  const toolUse = filtered.some(
    (part) =>
      part['type'] === 'tool_use' && typeof part['id'] === 'string' && part['id'].trim() !== '',
  );

  return toolUse ? filtered : null;
}

function sameParts(left: readonly JsonObject[], right: readonly JsonObject[]): boolean {
  return (
    left.length === right.length &&
    left.every((part, index) => canonicalJson(part) === canonicalJson(right[index]))
  );
}

function assistantContent(message: unknown): JsonObject[] | null {
  if (!isJsonObject(message)) return null;
  if (String(message['role']).trim().toLowerCase() !== 'assistant') return null;

  return contentParts(message['content']);
}

function matchingAssistant(
  message: unknown,
  cachedPlain: readonly JsonObject[],
): message is JsonObject {
  const current = assistantContent(message);

  if (current === null || hasThinking(current)) return false;

  const currentPlain = nonThinkingParts(current);

  return currentPlain !== null && sameParts(currentPlain, cachedPlain);
}

function restoredMessages(messages: unknown[], cached: JsonObject[]): unknown[] | null {
  const cachedPlain = nonThinkingParts(cached);

  if (cachedPlain === null) return null;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (!matchingAssistant(message, cachedPlain)) continue;

    const updated = [...messages];

    updated[index] = { ...message, content: structuredClone(cached) };

    return updated;
  }

  return null;
}

export function restoreKimiThinkingContent(
  body: JsonObject,
  cachedContent: unknown,
): ReplayInjection {
  const cached = contentParts(cachedContent);
  const messages = body['messages'];

  if (cached === null || !Array.isArray(messages)) return { body, applied: false };

  const restored = restoredMessages(messages, cached);

  return restored === null
    ? { body, applied: false }
    : { body: { ...body, messages: restored }, applied: true };
}

export function replayableKimiThinkingContent(content: unknown): boolean {
  const parts = contentParts(content);

  if (parts === null) return false;

  const signedThinking = parts.some(
    (part) =>
      part['type'] === 'thinking' &&
      typeof part['signature'] === 'string' &&
      part['signature'].trim() !== '',
  );
  const toolUse = parts.some(
    (part) =>
      part['type'] === 'tool_use' && typeof part['id'] === 'string' && part['id'].trim() !== '',
  );

  return signedThinking && toolUse;
}

function replayKey(model: string, scope: string): string {
  return `${kimiThinkingReplayModelFamily(model)}\0${scope}`;
}

export class KimiThinkingReplay {
  readonly #entries = new Map<string, JsonObject[]>();

  public commit(model: string, scope: string, content: unknown): boolean {
    const parts = contentParts(content);

    if (scope.trim() === '' || parts === null || !replayableKimiThinkingContent(parts))
      return false;

    this.#entries.set(replayKey(model, scope), structuredClone(parts));

    return true;
  }

  public inject(model: string, scope: string, body: JsonObject): ReplayInjection {
    const content = this.#entries.get(replayKey(model, scope));

    return content === undefined
      ? { body, applied: false }
      : restoreKimiThinkingContent(body, content);
  }

  public clear(model: string, scope: string): void {
    this.#entries.delete(replayKey(model, scope));
  }

  public clearAll(): void {
    this.#entries.clear();
  }
}
