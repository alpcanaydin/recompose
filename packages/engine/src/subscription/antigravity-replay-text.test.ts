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

describe('closing Antigravity text signature segments', () => {
  test('a duplicate detached carrier does not split the following segment', async () => {
    const first = nativeSignature(0x48);
    const second = nativeSignature(0x49);
    const { replay, key } = await replayFromResponse([
      { text: 'a', thought: true },
      { text: '', thought: true, thoughtSignature: first },
      { text: 'b', thought: true },
      { text: '', thought: true, thoughtSignature: first },
      { text: 'c', thought: true, thoughtSignature: second },
    ]);
    const body = {
      model: 'gemini-3.6-flash-high',
      contents: [
        {
          role: 'model',
          parts: [
            { text: 'a', thought: true },
            { text: 'bc', thought: true },
          ],
        },
      ],
    };
    const injected = replay.inject(key, body);

    expect(injected).toHaveProperty('contents.0.parts.0.thoughtSignature', first);
    expect(injected).toHaveProperty('contents.0.parts.1.thoughtSignature', second);
  });
});

describe('discarding unmatched Antigravity text carriers', () => {
  test('drops an unmatched consecutive carrier before a directly signed segment', async () => {
    const first = nativeSignature(0x4a);
    const unmatched = nativeSignature(0x4b);
    const direct = nativeSignature(0x4c);
    const { replay, key } = await replayFromResponse([
      { text: 'a' },
      { text: '', thoughtSignature: first },
      { text: '', thoughtSignature: unmatched },
      { text: 'b', thoughtSignature: direct },
    ]);
    const body = {
      model: 'gemini-3.6-flash-high',
      contents: [{ role: 'model', parts: [{ text: 'a' }, { text: 'b' }] }],
    };
    const injected = replay.inject(key, body);

    expect(injected).toHaveProperty('contents.0.parts.0.thoughtSignature', first);
    expect(injected).toHaveProperty('contents.0.parts.1.thoughtSignature', direct);
    expect(JSON.stringify(injected)).not.toContain(unmatched);
  });

  test('a part that carries neither text nor a signature changes nothing', async () => {
    const signature = nativeSignature(0x4e);
    const { replay, key } = await replayFromResponse([
      { thought: true },
      { text: 'hidden', thought: true, thoughtSignature: signature },
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

  test('a direct signature closes before later unsigned text', async () => {
    const signature = nativeSignature(0x4d);
    const { replay, key } = await replayFromResponse([
      { text: 'signed', thoughtSignature: signature },
      { text: 'unsigned' },
    ]);
    const body = {
      model: 'gemini-3.6-flash-high',
      contents: [{ role: 'model', parts: [{ text: 'signed' }, { text: 'unsigned' }] }],
    };
    const injected = replay.inject(key, body);

    expect(injected).toHaveProperty('contents.0.parts.0.thoughtSignature', signature);
    expect(injected).not.toHaveProperty('contents.0.parts.1.thoughtSignature');
  });
});
