import type { JsonObject } from '../gateway-wire';
import type { AntigravityReplayItem } from './antigravity-replay-items';

import { isJsonObject, parsedJson } from '../gateway-wire';
import { mergedReplayItems, replayItemKey, scanReplayParts } from './antigravity-replay-items';
import {
  finalizeTextReplay,
  scanTextReplayParts,
  type TextReplayState,
} from './antigravity-replay-text';
import { observingSseLines } from './observing-sse';

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

type ReplayObservation = {
  baseline: readonly AntigravityReplayItem[];
  items: AntigravityReplayItem[];
  pendingSignature?: string;
  text: TextReplayState;
  completed: boolean;
};

function observedValue(value: unknown, accumulated: ReplayObservation): ReplayObservation {
  const parts = candidateParts(value);
  const scan = scanReplayParts(parts, accumulated.pendingSignature);
  const rawText = scanTextReplayParts(parts, accumulated.text);
  const text = completed(value) ? finalizeTextReplay(rawText) : rawText;
  const pendingSignature = scan.pendingSignature;
  const incoming = offsetOccurrences(
    [...accumulated.baseline, ...accumulated.items],
    [...scan.items, ...text.items],
  );

  return {
    baseline: accumulated.baseline,
    items: mergedReplayItems(accumulated.items, incoming),
    ...(pendingSignature === undefined ? {} : { pendingSignature }),
    text: text.state,
    completed: completed(value),
  };
}

function offsetOccurrences(
  accumulated: AntigravityReplayItem[],
  incoming: AntigravityReplayItem[],
): AntigravityReplayItem[] {
  const counts = occurrenceCounts(accumulated);

  return incoming.map((item) => withNextOccurrence(item, counts));
}

function occurrenceCounts(items: AntigravityReplayItem[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const item of items) {
    if (item.id !== '') continue;

    const key = replayItemKey(item);

    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function withNextOccurrence(
  item: AntigravityReplayItem,
  counts: Map<string, number>,
): AntigravityReplayItem {
  if (item.id !== '') return item;

  const key = replayItemKey(item);
  const occurrence = counts.get(key) ?? 0;

  counts.set(key, occurrence + 1);

  return { ...item, occurrence };
}

function observeLine(line: string, accumulated: ReplayObservation): ReplayObservation {
  if (!line.startsWith('data:')) return { ...accumulated, completed: false };

  return observedValue(parsedJson(line.slice(5).trim()), accumulated);
}

function observingStream(
  body: ReadableStream<Uint8Array>,
  commit: (items: AntigravityReplayItem[]) => void,
  baseline: readonly AntigravityReplayItem[],
): ReadableStream<Uint8Array> {
  let observation: ReplayObservation = {
    baseline,
    items: [],
    text: { buffer: '', thought: false },
    completed: false,
  };

  return observingSseLines(body, (line) => {
    observation = observeLine(line, observation);

    if (observation.completed) commit(observation.items);
  });
}

async function observeJson(
  response: Response,
  commit: (items: AntigravityReplayItem[]) => void,
  clear: () => void,
  baseline: readonly AntigravityReplayItem[],
): Promise<Response> {
  const text = await response.clone().text();

  if (invalidSignature(response, text)) clear();
  if (!response.ok) return response;

  const observed = observedValue(parsedJson(text), {
    baseline,
    items: [],
    text: { buffer: '', thought: false },
    completed: false,
  });

  if (observed.completed) commit(observed.items);

  return response;
}

export async function observeAntigravityReasoning(
  response: Response,
  commit: (items: AntigravityReplayItem[]) => void,
  clear: () => void,
  baseline?: readonly AntigravityReplayItem[],
): Promise<Response> {
  const existing = observationBaseline(baseline);
  const stream = response.headers.get('content-type')?.includes('text/event-stream') === true;

  if (!stream || response.body === null || !response.ok)
    return observeJson(response, commit, clear, existing);

  return new Response(observingStream(response.body, commit, existing), response);
}

function observationBaseline(
  baseline: readonly AntigravityReplayItem[] | undefined,
): readonly AntigravityReplayItem[] {
  return baseline ?? [];
}
