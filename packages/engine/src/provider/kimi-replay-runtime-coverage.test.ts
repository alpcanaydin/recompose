import { beforeEach, describe, expect, test } from 'vitest';

import type { Crossing, JsonObject } from '../gateway-wire';

import { clearKimiReplayCache, observeKimiReplay, prepareKimiReplay } from './kimi-replay-runtime';

const cachedContent = [
  { type: 'thinking', thinking: 'full reasoning', signature: 'kimi-signature' },
  { type: 'text', text: 'I will inspect the file.' },
  { type: 'tool_use', id: 'toolu_1', name: 'Read', input: { path: 'README.md' } },
];

function aKimiCrossing(): Crossing {
  return {
    dialect: 'anthropic',
    raw: {},
    gatewayName: 'moonshot',
    virtualModel: 'kimi',
    providerModel: 'kimi-k2',
    replayScopeId: 'scope-1',
    callerFingerprint: 'caller-1',
  };
}

function aCompactedBody(): JsonObject {
  return {
    messages: [
      { role: 'user', content: 'inspect' },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'I will inspect the file.' },
          { type: 'tool_use', id: 'toolu_1', name: 'Read', input: { path: 'README.md' } },
        ],
      },
    ],
  };
}

function anEventStream(payload: string): Response {
  return new Response(payload, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

describe('observeKimiReplay: an answer the cache cannot read', () => {
  beforeEach(() => {
    clearKimiReplayCache();
  });

  test('caches nothing when the answer is a list rather than a message', async () => {
    await observeKimiReplay(aKimiCrossing(), Response.json([]));

    expect(prepareKimiReplay(aKimiCrossing(), aCompactedBody())).toEqual(aCompactedBody());
  });

  test('caches nothing when the message carries no content', async () => {
    await observeKimiReplay(aKimiCrossing(), Response.json({ id: 'msg_1' }));

    expect(prepareKimiReplay(aKimiCrossing(), aCompactedBody())).toEqual(aCompactedBody());
  });

  test('returns a streamed answer that carries no body as it arrived', async () => {
    const response = new Response(null, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });

    expect(await observeKimiReplay(aKimiCrossing(), response)).toBe(response);
  });
});

describe('observeKimiReplay: a replayed request that fails upstream', () => {
  beforeEach(() => {
    clearKimiReplayCache();
  });

  test('drops the cached thinking so the next request is not replayed again', async () => {
    await observeKimiReplay(aKimiCrossing(), Response.json({ content: cachedContent }));
    const replayed = aKimiCrossing();

    expect(prepareKimiReplay(replayed, aCompactedBody())).toHaveProperty(
      'messages.1.content',
      cachedContent,
    );

    const failed = await observeKimiReplay(replayed, anEventStream('data: {"type":"error"}\n\n'));

    await failed.text();

    expect(prepareKimiReplay(aKimiCrossing(), aCompactedBody())).toEqual(aCompactedBody());
  });
});
