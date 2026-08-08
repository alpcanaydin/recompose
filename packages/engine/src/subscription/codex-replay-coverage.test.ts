import { describe, expect, it } from 'vitest';

import type { JsonObject } from '../gateway-wire';

import { CodexReasoningReplay } from './codex-replay';

const MAX_REPLAY_SESSIONS = 4096;

const reasoning = {
  type: 'reasoning',
  id: 'rs_1',
  encrypted_content: 'gAAAAAA',
};

function bodyFor(): JsonObject {
  return { input: [{ type: 'message', role: 'user', content: [] }] };
}

function replayHolding(sessions: number): CodexReasoningReplay {
  const replay = new CodexReasoningReplay();

  for (let index = 0; index < sessions; index += 1) {
    replay.commit(`session-${String(index)}`, [reasoning]);
  }

  return replay;
}

describe('a Codex replay cache that outgrows its session budget', () => {
  it('keeps the newest session it was given', () => {
    const replay = replayHolding(MAX_REPLAY_SESSIONS + 1);
    const newest = `session-${String(MAX_REPLAY_SESSIONS)}`;

    expect(replay.inject(newest, bodyFor())).toHaveProperty('input.0.encrypted_content', 'gAAAAAA');
  });

  it('forgets the oldest session it was given', () => {
    const replay = replayHolding(MAX_REPLAY_SESSIONS + 1);
    const body = bodyFor();

    expect(replay.inject('session-0', body)).toEqual(body);
  });

  it('keeps every session while it stays inside the budget', () => {
    const replay = replayHolding(MAX_REPLAY_SESSIONS);

    expect(replay.inject('session-0', bodyFor())).toHaveProperty(
      'input.0.encrypted_content',
      'gAAAAAA',
    );
  });
});
