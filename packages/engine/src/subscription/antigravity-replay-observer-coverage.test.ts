import { describe, expect, it } from 'vitest';

import type { AntigravityReplayItem } from './antigravity-replay-items';

import { AntigravityReasoningReplay, observeAntigravityReasoning } from './antigravity-replay';
import { nativeSignature } from './antigravity-replay.testkit';

const body = { model: 'gemini-3.6-flash-high', contents: [] };

async function replayedFrom(payload: unknown): Promise<readonly AntigravityReplayItem[]> {
  const replay = new AntigravityReasoningReplay();
  const key = 'account-1\0gemini-3.6-flash-high\0session-1';

  await observeAntigravityReasoning(
    Response.json(payload),
    (items) => {
      replay.commit(key, items);
    },
    () => {},
  );

  return replay.snapshot(key);
}

function candidateOf(candidate: unknown): unknown {
  return { candidates: [candidate] };
}

describe('an Antigravity answer the observer cannot read', () => {
  it('remembers nothing from a body that is not an object', async () => {
    await expect(replayedFrom(['not', 'an', 'object'])).resolves.toEqual([]);
  });

  it('remembers nothing from a body that names no candidates', async () => {
    await expect(replayedFrom({ promptFeedback: 'blocked' })).resolves.toEqual([]);
  });

  it('remembers nothing from a candidate that is not an object', async () => {
    await expect(replayedFrom(candidateOf('finished'))).resolves.toEqual([]);
  });

  it('remembers nothing from a candidate that carries no content', async () => {
    await expect(replayedFrom(candidateOf({ finishReason: 'STOP' }))).resolves.toEqual([]);
  });

  it('remembers nothing from content whose parts are not a list', async () => {
    const candidate = { content: { role: 'model', parts: 'text' }, finishReason: 'STOP' };

    await expect(replayedFrom(candidateOf(candidate))).resolves.toEqual([]);
  });
});

describe('an Antigravity answer that has not finished', () => {
  it('holds back its signatures until a finish reason arrives', async () => {
    const candidate = {
      content: { role: 'model', parts: [{ text: 'hello', thoughtSignature: nativeSignature() }] },
    };
    const remembered = await replayedFrom(candidateOf(candidate));

    expect(remembered).toEqual([]);
    expect(new AntigravityReasoningReplay().inject('missing', body)).toBe(body);
  });
});
