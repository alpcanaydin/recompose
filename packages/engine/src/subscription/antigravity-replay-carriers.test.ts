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

test('repeated ID-less calls retain distinct occurrence signatures', async () => {
  const replay = new AntigravityReasoningReplay();
  const first = nativeSignature(0x39);
  const second = nativeSignature(0x40);
  const body = {
    model: 'gemini-3.6-flash-high',
    contents: [
      {
        role: 'model',
        parts: [
          { functionCall: { name: 'run', args: { command: 'same' } } },
          { functionCall: { name: 'run', args: { command: 'same' } } },
        ],
      },
    ],
  };
  const key = antigravityReplayKey('account-1', body, 'session-1');
  const response = Response.json(
    responseOf([
      { functionCall: { name: 'run', args: { command: 'same' } }, thoughtSignature: first },
      { functionCall: { name: 'run', args: { command: 'same' } }, thoughtSignature: second },
    ]),
  );

  await observeAntigravityReasoning(
    response,
    (items) => {
      replay.commit(key, items);
    },
    () => {},
  );

  const injected = replay.inject(key, body);

  expect(injected).toHaveProperty('contents.0.parts.0.thoughtSignature', first);
  expect(injected).toHaveProperty('contents.0.parts.1.thoughtSignature', second);
});

test('repeated ID-less calls remain distinct across separate SSE chunks', async () => {
  const replay = new AntigravityReasoningReplay();
  const first = nativeSignature(0x41);
  const second = nativeSignature(0x42);
  const body = {
    model: 'gemini-3.6-flash-high',
    contents: [
      {
        role: 'model',
        parts: [
          { functionCall: { name: 'run', args: { command: 'same' } } },
          { functionCall: { name: 'run', args: { command: 'same' } } },
        ],
      },
    ],
  };
  const key = antigravityReplayKey('account-1', body, 'session-1');
  const chunks = [
    responseOf(
      [{ functionCall: { name: 'run', args: { command: 'same' } }, thoughtSignature: first }],
      null,
    ),
    responseOf([
      { functionCall: { name: 'run', args: { command: 'same' } }, thoughtSignature: second },
    ]),
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

  const injected = replay.inject(key, body);

  expect(injected).toHaveProperty('contents.0.parts.0.thoughtSignature', first);
  expect(injected).toHaveProperty('contents.0.parts.1.thoughtSignature', second);
});

test('a reused ID with changed arguments never receives a stale signature', () => {
  const replay = new AntigravityReasoningReplay();
  const body = {
    model: 'gemini-3.6-flash-high',
    contents: [
      {
        role: 'model',
        parts: [
          { functionCall: { id: 'reused', name: 'run', args: { command: 'new' } } },
          { functionCall: { id: 'other', name: 'run', args: { command: 'old' } } },
        ],
      },
    ],
  };
  const key = antigravityReplayKey('account-1', body, 'session-1');

  replay.commit(key, [
    {
      id: 'reused',
      name: 'run',
      args: { command: 'old' },
      signature: nativeSignature(),
    },
  ]);

  const injected = replay.inject(key, body);

  expect(injected).not.toHaveProperty('contents.0.parts.0.thoughtSignature');
  expect(injected).not.toHaveProperty('contents.0.parts.1.thoughtSignature');
});
