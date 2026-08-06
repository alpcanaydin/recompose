import { expect, test } from 'vitest';

import {
  AntigravityReasoningReplay,
  antigravityReplayKey,
  observeAntigravityReasoning,
} from './antigravity-replay';
import { nativeSignature, responseOf } from './antigravity-replay.testkit';

const body = { model: 'gemini-3.6-flash-high', contents: [] };

async function observed(
  replay: AntigravityReasoningReplay,
  key: string,
  parts: unknown[],
): Promise<void> {
  await observeAntigravityReasoning(
    Response.json(responseOf(parts)),
    (items) => {
      replay.commit(key, items);
    },
    () => {
      replay.clear(key);
    },
    replay.snapshot(key),
  );
}

test('a terminal response without replay items clears an older chain', async () => {
  const replay = new AntigravityReasoningReplay();
  const key = antigravityReplayKey('account-1', body, 'session-1');

  replay.commit(key, [{ id: '', name: '', args: {}, text: 'old', signature: nativeSignature() }]);
  await observed(replay, key, [{ text: 'answer without signature' }]);

  expect(replay.snapshot(key)).toEqual([]);
});

test('same text in a later response receives the next ledger occurrence', async () => {
  const replay = new AntigravityReasoningReplay();
  const key = antigravityReplayKey('account-1', body, 'session-1');
  const first = nativeSignature(0x51);
  const second = nativeSignature(0x52);

  replay.commit(key, [
    { id: '', name: '', args: {}, text: 'same', thought: false, signature: first, occurrence: 0 },
  ]);
  await observed(replay, key, [{ text: 'same', thoughtSignature: second }]);

  const request = {
    model: body.model,
    contents: [{ role: 'model', parts: [{ text: 'same' }, { text: 'same' }] }],
  };
  const injected = replay.inject(key, request);

  expect(injected).toHaveProperty('contents.0.parts.0.thoughtSignature', first);
  expect(injected).toHaveProperty('contents.0.parts.1.thoughtSignature', second);
});

test('surrounding context drift keeps an exact text fingerprint', () => {
  const replay = new AntigravityReasoningReplay();
  const key = antigravityReplayKey('account-1', body, 'session-1');
  const signature = nativeSignature(0x53);
  const request = {
    model: body.model,
    contents: [
      { role: 'user', parts: [{ text: 'new context' }] },
      { role: 'model', parts: [{ text: 'same answer' }] },
    ],
  };

  replay.commit(key, [
    { id: '', name: '', args: {}, text: 'same answer', thought: false, signature, occurrence: 0 },
  ]);

  expect(replay.inject(key, request)).toHaveProperty(
    'contents.1.parts.0.thoughtSignature',
    signature,
  );
});

test('an edited text fingerprint never receives a stale signature', () => {
  const replay = new AntigravityReasoningReplay();
  const key = antigravityReplayKey('account-1', body, 'session-1');
  const request = {
    model: body.model,
    contents: [{ role: 'model', parts: [{ text: 'edited answer' }] }],
  };

  replay.commit(key, [
    {
      id: '',
      name: '',
      args: {},
      text: 'original answer',
      thought: false,
      signature: nativeSignature(0x54),
      occurrence: 0,
    },
  ]);

  const injected = replay.inject(key, request);

  expect(injected).toEqual(request);
  expect(injected).not.toHaveProperty('contents.0.parts.0.thoughtSignature');
});
