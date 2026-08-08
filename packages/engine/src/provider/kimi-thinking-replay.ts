import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';
import { canonicalJson } from '../subscription/canonical-json';
import { normalizeKimiUpstreamModel } from './kimi-request';

type ReplayInjection = { body: JsonObject; applied: boolean };

const MAX_ENTRY_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;
const MAX_ENTRIES = 10_240;

type ReplayEntry = {
  content: JsonObject[];
  generation: number;
  deleted: boolean;
  bytes: number;
};

export type KimiReplaySnapshot = { generation: number; found: boolean };

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
  readonly #entries = new Map<string, ReplayEntry>();
  #generation = 0;
  #totalBytes = 0;

  public commit(model: string, scope: string, content: unknown): boolean {
    const parts = contentParts(content);

    if (scope.trim() === '' || parts === null || !replayableKimiThinkingContent(parts))
      return false;

    return this.store(replayKey(model, scope), parts);
  }

  public snapshot(model: string, scope: string): KimiReplaySnapshot {
    const key = replayKey(model, scope);
    const existing = this.#entries.get(key);

    if (existing !== undefined) {
      return { generation: existing.generation, found: !existing.deleted };
    }

    const entry = this.tombstone();

    this.#entries.set(key, entry);
    this.evictOldest();

    return { generation: entry.generation, found: false };
  }

  public replaceIfUnchanged(
    model: string,
    scope: string,
    snapshot: KimiReplaySnapshot,
    content: unknown,
  ): boolean {
    const parts = contentParts(content);

    if (parts === null || !replayableKimiThinkingContent(parts)) return false;

    const key = replayKey(model, scope);
    const current = this.#entries.get(key);

    return current?.generation === snapshot.generation ? this.store(key, parts) : false;
  }

  public deleteIfUnchanged(model: string, scope: string, snapshot: KimiReplaySnapshot): boolean {
    const key = replayKey(model, scope);
    const current = this.#entries.get(key);

    if (current?.generation !== snapshot.generation) return false;

    this.replaceEntry(key, this.tombstone());

    return true;
  }

  public inject(model: string, scope: string, body: JsonObject): ReplayInjection {
    const entry = this.#entries.get(replayKey(model, scope));

    return entry === undefined || entry.deleted
      ? { body, applied: false }
      : restoreKimiThinkingContent(body, entry.content);
  }

  public clear(model: string, scope: string): void {
    this.deleteEntry(replayKey(model, scope));
  }

  public clearAll(): void {
    this.#entries.clear();
    this.#totalBytes = 0;
  }

  public totalBytes(): number {
    return this.#totalBytes;
  }

  private store(key: string, content: JsonObject[]): boolean {
    const cloned = structuredClone(content);
    const bytes = Buffer.byteLength(JSON.stringify(cloned));
    const previous = this.#entries.get(key)?.bytes ?? 0;

    if (bytes > MAX_ENTRY_BYTES) return false;
    if (this.#totalBytes - previous + bytes > MAX_TOTAL_BYTES) return false;

    this.replaceEntry(key, {
      content: cloned,
      generation: this.nextGeneration(),
      deleted: false,
      bytes,
    });
    this.evictOldest();

    return true;
  }

  private tombstone(): ReplayEntry {
    return { content: [], generation: this.nextGeneration(), deleted: true, bytes: 0 };
  }

  private replaceEntry(key: string, entry: ReplayEntry): void {
    this.#totalBytes -= this.#entries.get(key)?.bytes ?? 0;
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    this.#totalBytes += entry.bytes;
  }

  private deleteEntry(key: string): void {
    const entry = this.#entries.get(key);

    if (entry === undefined) return;

    this.#totalBytes -= entry.bytes;
    this.#entries.delete(key);
  }

  private nextGeneration(): number {
    this.#generation += 1;

    return this.#generation;
  }

  private evictOldest(): void {
    while (this.#entries.size > MAX_ENTRIES) {
      const oldest = this.#entries.keys().next().value;

      if (typeof oldest !== 'string') return;

      this.deleteEntry(oldest);
    }
  }
}
