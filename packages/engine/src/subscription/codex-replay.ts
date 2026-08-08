import type { JsonObject } from '../gateway-wire';

import { insertReplayTurns } from './codex-replay-insert';
import { replayTurnFrom, type ReplayTurn } from './codex-replay-turns';

export { codexReplayPrefixFingerprint } from './codex-replay-turns';
export { observeCodexReasoning } from './codex-replay-observer';

const MAX_REPLAY_SESSIONS = 4096;
const MAX_TURNS_PER_SESSION = 256;

export class CodexReasoningReplay {
  readonly #turns = new Map<string, ReplayTurn[]>();

  inject(key: string, body: JsonObject): JsonObject {
    const turns = this.#turns.get(key);
    const input = body['input'];

    if (turns === undefined || !Array.isArray(input)) return body;

    return { ...body, input: insertReplayTurns(input, turns) };
  }

  commit(key: string, output: unknown, requestBody?: JsonObject): void {
    const turn = replayTurnFrom(output, requestBody);

    if (turn === undefined) return;

    const turns = [...(this.#turns.get(key) ?? []), turn].slice(-MAX_TURNS_PER_SESSION);

    this.#turns.delete(key);
    this.#turns.set(key, turns);
    this.evictOldest();
  }

  clear(key: string): void {
    this.#turns.delete(key);
  }

  private evictOldest(): void {
    if (this.#turns.size <= MAX_REPLAY_SESSIONS) return;

    const oldest = this.#turns.keys().next().value;

    if (typeof oldest === 'string') this.#turns.delete(oldest);
  }
}
