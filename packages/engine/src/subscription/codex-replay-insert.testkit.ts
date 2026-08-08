import type { JsonObject } from '../gateway-wire';
import type { ReplayTurn } from './codex-replay-turns';

export function assistantSaying(content: unknown): JsonObject {
  return { type: 'message', role: 'assistant', content };
}

export function reasoningItem(signature: unknown): JsonObject {
  return { type: 'reasoning', summary: [], content: null, encrypted_content: signature };
}

export function replayTurn(overrides: Partial<ReplayTurn>): ReplayTurn {
  return { reasoning: [], calls: [], callIds: [], ...overrides };
}
