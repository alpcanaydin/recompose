import { describe, expect, test } from 'vitest';

import {
  AntigravityReasoningReplay,
  antigravityReplayKey,
  observeAntigravityReasoning,
} from './antigravity-replay';
import { nativeSignature, responseOf, toolResultBody } from './antigravity-replay.testkit';

async function observedReplay(parts: unknown[]) {
  const replay = new AntigravityReasoningReplay();
  const body = toolResultBody();
  const key = antigravityReplayKey('account-1', body, 'session-1');

  await observeAntigravityReasoning(
    Response.json(responseOf(parts)),
    (items) => {
      replay.commit(key, items);
    },
    () => {},
  );

  return { replay, body, key };
}

describe('associating Antigravity signature carriers', () => {
  test('associates a detached signature carrier with the following function call', async () => {
    const signature = nativeSignature();
    const { replay, body, key } = await observedReplay([
      { text: '', thought: true, thoughtSignature: signature },
      { functionCall: { id: 'call-1', name: 'Bash', args: {} } },
    ]);

    expect(replay.inject(key, body)).toHaveProperty(
      'contents.1.parts.0.thoughtSignature',
      signature,
    );
  });

  test('attaches a detached signature that follows a function call', async () => {
    const signature = nativeSignature();
    const { replay, body, key } = await observedReplay([
      { functionCall: { id: 'call-1', name: 'Bash', args: {} } },
      { text: '', thoughtSignature: signature },
    ]);

    expect(replay.inject(key, body)).toHaveProperty(
      'contents.1.parts.0.thoughtSignature',
      signature,
    );
  });
});

test('a detached signature crosses SSE chunks to the next function call', async () => {
  const replay = new AntigravityReasoningReplay();
  const body = toolResultBody();
  const key = antigravityReplayKey('account-1', body, 'session-1');
  const signature = nativeSignature();
  const chunks = [
    responseOf([{ text: '', thoughtSignature: signature }], null),
    responseOf([{ functionCall: { id: 'call-1', name: 'Bash', args: {} } }]),
  ];
  const stream = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('');
  const response = new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
  const observed = await observeAntigravityReasoning(
    response,
    (items) => {
      replay.commit(key, items);
    },
    () => {},
  );

  await observed.text();

  expect(replay.inject(key, body)).toHaveProperty('contents.1.parts.0.thoughtSignature', signature);
});
