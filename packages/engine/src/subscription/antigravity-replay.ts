import type { JsonObject } from '../gateway-wire';
import type { AntigravityReplayItem } from './antigravity-replay-items';

import { injectAntigravityReplay } from './antigravity-replay-inject';
import { mergedReplayItems } from './antigravity-replay-items';
import { canonicalJson } from './canonical-json';

const MAX_SESSIONS = 4096;
const MAX_ITEMS = 256;

type ReplayEntry = {
  items: AntigravityReplayItem[];
  generation: number;
  branch: number;
  deleted: boolean;
};

export type AntigravityReplaySnapshot = {
  generation: number;
  branch: number;
  items: readonly AntigravityReplayItem[];
  found: boolean;
};

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
  readonly #entries = new Map<string, ReplayEntry>();
  readonly #fences = new Map<string, number>();
  #generation = 0;
  #branch = 0;

  inject(key: string, body: JsonObject): JsonObject {
    const entry = this.#entries.get(key);

    return injectAntigravityReplay(body, entry === undefined || entry.deleted ? [] : entry.items);
  }

  commit(key: string, items: AntigravityReplayItem[]): void {
    if (items.length === 0) {
      this.clear(key);

      return;
    }

    const previous = this.#entries.get(key);
    const previousItems = liveItems(previous);
    const merged = mergedReplayItems(previousItems, items).slice(-MAX_ITEMS);
    const branch = branchForCommit(previous, previousItems, merged, this.nextBranch());

    this.store(key, merged, branch, false);
    this.evictOldest();
  }

  clear(key: string): void {
    this.store(key, [], this.nextBranch(), true);
    this.evictOldest();
  }

  snapshot(key: string): readonly AntigravityReplayItem[] {
    const entry = this.#entries.get(key);

    return entry === undefined || entry.deleted ? [] : entry.items;
  }

  stateSnapshot(key: string): AntigravityReplaySnapshot {
    const existing = this.#entries.get(key);

    if (existing !== undefined) return snapshotOf(existing);

    const reserved = this.store(key, [], this.nextBranch(), true);

    this.evictOldest();

    return snapshotOf(reserved);
  }

  replaceIfUnchanged(
    key: string,
    snapshot: AntigravityReplaySnapshot,
    items: AntigravityReplayItem[],
  ): boolean {
    const current = this.#entries.get(key);

    if (!canReplace(current, snapshot, items)) return false;

    const branch = isPrefix(current.items, items) ? current.branch : this.nextBranch();

    this.store(key, items.slice(-MAX_ITEMS), branch, false);

    return true;
  }

  deleteIfUnchanged(key: string, snapshot: AntigravityReplaySnapshot): boolean {
    const current = this.#entries.get(key);

    if (current?.generation !== snapshot.generation) return false;

    this.store(key, [], this.nextBranch(), true);

    return true;
  }

  entryCount(): number {
    return this.#entries.size;
  }

  evictOldestForTest(count: number): void {
    for (let index = 0; index < count; index += 1) this.evictOne();
  }

  private evictOldest(): void {
    while (this.#entries.size > MAX_SESSIONS) this.evictOne();
  }

  private evictOne(): void {
    const oldest = this.#entries.keys().next().value;

    if (typeof oldest === 'string') this.#entries.delete(oldest);
  }

  private store(
    key: string,
    items: AntigravityReplayItem[],
    branch: number,
    deleted: boolean,
  ): ReplayEntry {
    const entry = {
      items: structuredClone(items),
      generation: this.nextGeneration(),
      branch,
      deleted,
    };

    this.#entries.delete(key);
    this.#entries.set(key, entry);
    this.#fences.set(key, entry.generation);

    return entry;
  }

  private nextGeneration(): number {
    this.#generation += 1;

    return this.#generation;
  }

  private nextBranch(): number {
    this.#branch += 1;

    return this.#branch;
  }
}

function liveItems(entry: ReplayEntry | undefined): AntigravityReplayItem[] {
  return entry === undefined || entry.deleted ? [] : entry.items;
}

function branchForCommit(
  previous: ReplayEntry | undefined,
  previousItems: readonly AntigravityReplayItem[],
  merged: readonly AntigravityReplayItem[],
  nextBranch: number,
): number {
  return isPrefix(previousItems, merged) ? (previous?.branch ?? nextBranch) : nextBranch;
}

function canReplace(
  current: ReplayEntry | undefined,
  snapshot: AntigravityReplaySnapshot,
  items: readonly AntigravityReplayItem[],
): current is ReplayEntry {
  if (current === undefined) return false;

  return current.generation === snapshot.generation || descendantReplace(current, snapshot, items);
}

function snapshotOf(entry: ReplayEntry): AntigravityReplaySnapshot {
  return {
    generation: entry.generation,
    branch: entry.branch,
    items: structuredClone(entry.items),
    found: !entry.deleted,
  };
}

function isPrefix(
  prefix: readonly AntigravityReplayItem[],
  items: readonly AntigravityReplayItem[],
): boolean {
  if (prefix.length > items.length) return false;

  return prefix.every((item, index) => canonicalJson(item) === canonicalJson(items[index] ?? item));
}

function descendantReplace(
  current: ReplayEntry,
  snapshot: AntigravityReplaySnapshot,
  proposed: readonly AntigravityReplayItem[],
): boolean {
  return (
    current.branch === snapshot.branch &&
    isPrefix(snapshot.items, current.items) &&
    isPrefix(current.items, proposed)
  );
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

export { observeAntigravityReasoning } from './antigravity-replay-observer';
