import { describe, expect, test } from 'vitest';

import {
  AntigravityReasoningReplay,
  antigravityReplayKey,
  observeAntigravityReasoning,
} from './antigravity-replay';
import { nativeSignature, responseOf } from './antigravity-replay.testkit';

async function replayFromResponse(parts: unknown[]) {
  const replay = new AntigravityReasoningReplay();
  const body = { model: 'gemini-3.6-flash-high', contents: [] };
  const key = antigravityReplayKey('account-1', body, 'session-1');

  await observeAntigravityReasoning(
    Response.json(responseOf(parts)),
    (items) => {
      replay.commit(key, items);
    },
    () => {},
  );

  return { replay, key };
}

describe('replaying signed Antigravity text segments', () => {
  test('combines fragmented SSE text and attaches its terminal signature', async () => {
    const replay = new AntigravityReasoningReplay();
    const signature = nativeSignature();
    const body = {
      model: 'gemini-3.6-flash-high',
      contents: [{ role: 'model', parts: [{ text: 'answer-one' }] }],
    };
    const key = antigravityReplayKey('account-1', body, 'session-1');
    const chunks = [
      responseOf([{ text: 'answer-' }], null),
      responseOf([{ text: 'one' }], null),
      responseOf([{ text: '', thoughtSignature: signature }]),
    ];
    const response = new Response(
      chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join(''),
      { headers: { 'content-type': 'text/event-stream' } },
    );
    const observed = await observeAntigravityReasoning(
      response,
      (items) => {
        replay.commit(key, items);
      },
      () => {},
    );

    await observed.text();

    expect(replay.inject(key, body)).toHaveProperty(
      'contents.0.parts.0.thoughtSignature',
      signature,
    );
  });

  test('keeps consecutive directly signed text segments separate', async () => {
    const first = nativeSignature(0x43);
    const second = nativeSignature(0x44);
    const { replay, key } = await replayFromResponse([
      { text: 'a' },
      { text: 'b', thoughtSignature: first },
      { text: 'c', thoughtSignature: second },
    ]);
    const body = {
      model: 'gemini-3.6-flash-high',
      contents: [{ role: 'model', parts: [{ text: 'ab' }, { text: 'c' }] }],
    };

    const injected = replay.inject(key, body);

    expect(injected).toHaveProperty('contents.0.parts.0.thoughtSignature', first);
    expect(injected).toHaveProperty('contents.0.parts.1.thoughtSignature', second);
  });
});

describe('choosing Antigravity text signature carriers', () => {
  test('a direct text signature wins over an unbound prefix carrier', async () => {
    const prefix = nativeSignature(0x45);
    const direct = nativeSignature(0x46);
    const { replay, key } = await replayFromResponse([
      { text: '', thought: true, thoughtSignature: prefix },
      { text: 'hidden', thought: true, thoughtSignature: direct },
    ]);
    const body = {
      model: 'gemini-3.6-flash-high',
      contents: [{ role: 'model', parts: [{ text: 'hidden', thought: true }] }],
    };

    const injected = replay.inject(key, body);

    expect(injected).toHaveProperty('contents.0.parts.0.thoughtSignature', direct);
    expect(JSON.stringify(injected)).not.toContain(prefix);
  });

  test('a prefix carrier before thought text is retained at completion', async () => {
    const signature = nativeSignature(0x47);
    const { replay, key } = await replayFromResponse([
      { text: '', thought: true, thoughtSignature: signature },
      { text: 'hidden', thought: true },
    ]);
    const body = {
      model: 'gemini-3.6-flash-high',
      contents: [{ role: 'model', parts: [{ text: 'hidden', thought: true }] }],
    };

    expect(replay.inject(key, body)).toHaveProperty(
      'contents.0.parts.0.thoughtSignature',
      signature,
    );
  });
});
