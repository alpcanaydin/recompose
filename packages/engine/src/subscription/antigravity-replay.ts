import type { JsonObject } from '../gateway-wire';
import type { AntigravityReplayItem } from './antigravity-replay-items';

import { isJsonObject, parsedJson } from '../gateway-wire';
import { injectAntigravityReplay } from './antigravity-replay-inject';
import { mergedReplayItems, replayItemsFromParts } from './antigravity-replay-items';
import { observingSseLines } from './observing-sse';

const MAX_SESSIONS = 4096;
const MAX_ITEMS = 256;

export function antigravityReplayKey(
  accountId: string,
  body: JsonObject,
  sessionId: string,
): string {
  const model = typeof body['model'] === 'string' ? body['model'] : '';

  return `${accountId}\0${model}\0${sessionId}`;
}

export function antigravityUsesReplay(body: JsonObject): boolean {
  const model = typeof body['model'] === 'string' ? body['model'].toLowerCase() : '';

  return !model.includes('claude') && /gemini|flash|agent/u.test(model);
}

export class AntigravityReasoningReplay {
  readonly #items = new Map<string, AntigravityReplayItem[]>();

  inject(key: string, body: JsonObject): JsonObject {
    return injectAntigravityReplay(body, this.#items.get(key) ?? []);
  }

  commit(key: string, items: AntigravityReplayItem[]): void {
    if (items.length === 0) {
      this.clear(key);

      return;
    }

    const merged = mergedReplayItems(this.#items.get(key) ?? [], items).slice(-MAX_ITEMS);

    this.#items.delete(key);
    this.#items.set(key, merged);
    this.evictOldest();
  }

  clear(key: string): void {
    this.#items.delete(key);
  }

  private evictOldest(): void {
    if (this.#items.size <= MAX_SESSIONS) return;

    const oldest = this.#items.keys().next().value;

    if (typeof oldest === 'string') this.#items.delete(oldest);
  }
}

export function replayedAntigravityBody(
  replay: AntigravityReasoningReplay | undefined,
  accountId: string,
  body: JsonObject,
  sessionId: string,
): JsonObject {
  if (replay === undefined || !antigravityUsesReplay(body)) return body;

  return replay.inject(antigravityReplayKey(accountId, body, sessionId), body);
}

function firstCandidate(value: unknown): JsonObject | null {
  if (!isJsonObject(value) || !Array.isArray(value['candidates'])) return null;

  const candidates: unknown[] = value['candidates'];
  const candidate = candidates[0];

  return isJsonObject(candidate) ? candidate : null;
}

function candidateParts(value: unknown): unknown[] {
  const candidate = firstCandidate(value);

  if (candidate === null || !isJsonObject(candidate['content'])) return [];

  const parts = candidate['content']['parts'];

  if (!Array.isArray(parts)) return [];

  const values: unknown[] = parts;

  return values;
}

function completed(value: unknown): boolean {
  const candidate = firstCandidate(value);

  return candidate !== null && typeof candidate['finishReason'] === 'string';
}

function invalidSignature(response: Response, text: string): boolean {
  if (response.status !== 400) return false;

  return /thought_?signature|signature/iu.test(text);
}

function observedValue(value: unknown, accumulated: AntigravityReplayItem[]) {
  const items = replayItemsFromParts(candidateParts(value));

  return { items: mergedReplayItems(accumulated, items), completed: completed(value) };
}

function observeLine(line: string, accumulated: AntigravityReplayItem[]) {
  if (!line.startsWith('data:')) return { items: accumulated, completed: false };

  return observedValue(parsedJson(line.slice(5).trim()), accumulated);
}

function observingStream(
  body: ReadableStream<Uint8Array>,
  commit: (items: AntigravityReplayItem[]) => void,
): ReadableStream<Uint8Array> {
  let items: AntigravityReplayItem[] = [];

  return observingSseLines(body, (line) => {
    const observed = observeLine(line, items);

    items = observed.items;
    if (observed.completed) commit(items);
  });
}

async function observeJson(
  response: Response,
  commit: (items: AntigravityReplayItem[]) => void,
  clear: () => void,
): Promise<Response> {
  const text = await response.clone().text();

  if (invalidSignature(response, text)) clear();
  if (!response.ok) return response;

  const observed = observedValue(parsedJson(text), []);

  if (observed.completed) commit(observed.items);

  return response;
}

export async function observeAntigravityReasoning(
  response: Response,
  commit: (items: AntigravityReplayItem[]) => void,
  clear: () => void,
): Promise<Response> {
  const stream = response.headers.get('content-type')?.includes('text/event-stream') === true;

  if (!stream || response.body === null || !response.ok)
    return observeJson(response, commit, clear);

  return new Response(observingStream(response.body, commit), response);
}
