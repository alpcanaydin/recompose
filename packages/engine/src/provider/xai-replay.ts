import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';
import { canonicalJson } from '../subscription/canonical-json';

const REPLAY_TYPES = new Set(['reasoning', 'message', 'function_call', 'custom_tool_call']);
const MAX_SESSIONS = 4096;

function itemType(item: unknown): string {
  return isJsonObject(item) && typeof item['type'] === 'string' ? item['type'] : '';
}

function assistantMessage(item: unknown): item is JsonObject {
  if (!isJsonObject(item) || item['role'] !== 'assistant') return false;

  return item['type'] === undefined || item['type'] === 'message';
}

function textContent(content: unknown): JsonObject[] | null {
  if (typeof content === 'string') return [{ type: 'output_text', text: content }];
  if (!Array.isArray(content) || !content.every(isJsonObject)) return null;

  return content;
}

function sameAssistant(left: JsonObject, right: JsonObject): boolean {
  const leftContent = textContent(left['content']);
  const rightContent = textContent(right['content']);

  return (
    leftContent !== null &&
    rightContent !== null &&
    canonicalJson(leftContent) === canonicalJson(rightContent)
  );
}

function lastAssistant(input: unknown[]): { index: number; message: JsonObject } | undefined {
  for (let index = input.length - 1; index >= 0; index -= 1) {
    const message = input[index];

    if (assistantMessage(message)) return { index, message };
  }

  return undefined;
}

function replayAssistant(items: JsonObject[]): JsonObject | undefined {
  return items.find(assistantMessage);
}

function encryptedContent(item: unknown): string | undefined {
  return isJsonObject(item) &&
    item['type'] === 'reasoning' &&
    typeof item['encrypted_content'] === 'string'
    ? item['encrypted_content']
    : undefined;
}

function callId(item: unknown): string | undefined {
  if (!isJsonObject(item) || !['function_call', 'custom_tool_call'].includes(itemType(item))) {
    return undefined;
  }

  return typeof item['call_id'] === 'string' && item['call_id'].trim() !== ''
    ? item['call_id']
    : undefined;
}

function outputCallIds(input: unknown[]): Set<string> {
  return new Set(
    input.flatMap((item) => {
      if (!isJsonObject(item) || item['type'] !== 'function_call_output') return [];

      return typeof item['call_id'] === 'string' ? [item['call_id']] : [];
    }),
  );
}

function existingCallIds(input: unknown[]): Set<string> {
  return new Set(input.flatMap((item) => callId(item) ?? []));
}

function filteredCalls(items: JsonObject[], input: unknown[]): JsonObject[] {
  const outputs = outputCallIds(input);
  const existing = existingCallIds(input);

  return items.filter((item) => {
    const id = callId(item);

    return id !== undefined && outputs.has(id) && !existing.has(id);
  });
}

function missingReasoning(items: JsonObject[], input: unknown[]): JsonObject[] {
  const existing = new Set(input.map(encryptedContent).filter((value) => value !== undefined));

  return items.filter((item) => {
    const encrypted = encryptedContent(item);

    return encrypted !== undefined && !existing.has(encrypted);
  });
}

function insertCalls(input: unknown[], calls: JsonObject[]): unknown[] {
  const byOutput = new Map<string, JsonObject[]>();

  for (const call of calls) {
    const id = callId(call);

    if (id !== undefined) byOutput.set(id, [...(byOutput.get(id) ?? []), call]);
  }

  return input.flatMap((item) => {
    const id =
      isJsonObject(item) && item['type'] === 'function_call_output' ? item['call_id'] : undefined;
    const insertions = typeof id === 'string' ? (byOutput.get(id) ?? []) : [];

    return [...insertions, item];
  });
}

function assistantReplay(
  cached: JsonObject | undefined,
  current: { index: number; message: JsonObject } | undefined,
): { at: number; items: JsonObject[] } | null {
  if (cached === undefined) return { at: 0, items: [] };
  if (current === undefined) return { at: 0, items: [cached] };

  return sameAssistant(current.message, cached) ? { at: current.index, items: [] } : null;
}

function generalReplay(
  items: JsonObject[],
  input: unknown[],
): { at: number; items: JsonObject[] } | null {
  const cachedAssistant = replayAssistant(items);
  const currentAssistant = lastAssistant(input);
  const assistant = assistantReplay(cachedAssistant, currentAssistant);

  if (assistant === null) return null;

  const reasoning = missingReasoning(items, input);

  return { at: assistant.at, items: [...reasoning, ...assistant.items] };
}

function insertGeneral(input: unknown[], replay: { at: number; items: JsonObject[] }): unknown[] {
  return [...input.slice(0, replay.at), ...replay.items, ...input.slice(replay.at)];
}

function replayableItems(output: unknown): JsonObject[] {
  return Array.isArray(output)
    ? output.filter(
        (item): item is JsonObject => isJsonObject(item) && REPLAY_TYPES.has(itemType(item)),
      )
    : [];
}

export class XAIReasoningReplay {
  readonly #entries = new Map<string, JsonObject[]>();

  public inject(key: string, body: JsonObject): JsonObject {
    const cached = this.#entries.get(key);
    const input = body['input'];

    if (cached === undefined || !Array.isArray(input)) return body;

    const general = generalReplay(cached, input);

    if (general === null) return body;

    const calls = filteredCalls(cached, input);
    const withCalls = insertCalls(input, calls);
    const adjustedAt =
      general.at +
      calls.filter((call) => {
        const id = callId(call);
        const outputAt = input.findIndex((item) => isJsonObject(item) && item['call_id'] === id);

        return outputAt >= 0 && outputAt < general.at;
      }).length;

    return { ...body, input: insertGeneral(withCalls, { ...general, at: adjustedAt }) };
  }

  public commit(key: string, output: unknown): void {
    const items = replayableItems(output);

    if (items.length === 0) {
      this.#entries.delete(key);

      return;
    }

    this.#entries.delete(key);
    this.#entries.set(key, structuredClone(items));
    this.evictOldest();
  }

  public clear(): void {
    this.#entries.clear();
  }

  private evictOldest(): void {
    if (this.#entries.size <= MAX_SESSIONS) return;

    const oldest = this.#entries.keys().next().value;

    if (typeof oldest === 'string') this.#entries.delete(oldest);
  }
}
