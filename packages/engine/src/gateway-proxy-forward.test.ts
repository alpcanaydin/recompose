import type { SpendGrant } from '@recompose/contracts';

import { describe, expect, test } from 'vitest';

import type { SentRequest } from './gateway-app.testkit';

import { createGatewayApp } from './gateway-app';
import {
  aCredentialedGrant,
  aGatewayHolding,
  anOpenGrant,
  aVirtualModel,
  bodySentIn,
  fetchAnsweringWith,
  headersSentIn,
} from './gateway-app.testkit';

async function forwarded(grant: SpendGrant, path: string, body: unknown): Promise<SentRequest[]> {
  const { sent, fetchLike } = fetchAnsweringWith(() => Response.json({ choices: [] }));
  const app = createGatewayApp(
    aGatewayHolding(aVirtualModel()),
    async () => Promise.resolve(grant),
    fetchLike,
  );

  await app.request(`http://127.0.0.1:8397${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return sent;
}

const aChatAsk = {
  model: 'fast',
  messages: [{ role: 'user', content: 'hello' }],
};

const aHubAsk = {
  model: 'fast',
  system: [{ text: 'Answer briefly.' }],
  messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
};

describe('the request that crosses to the target', () => {
  test('forwards to the target origin under the real model name', async () => {
    const sent = await forwarded(aCredentialedGrant(), '/v1/chat/completions', aChatAsk);

    expect(sent.at(0)?.url).toBe('http://127.0.0.1:4242/v1/chat/completions');
    expect(sent.at(0)?.init?.method).toBe('POST');
    expect(bodySentIn(sent)['model']).toBe('gpt-5-mini');
  });

  test.each(['http://127.0.0.1:4242/', 'http://127.0.0.1:4242//'])(
    'every trailing slash on %s folds into one clean path',
    async (origin) => {
      const sent = await forwarded(aCredentialedGrant(origin), '/v1/chat/completions', aChatAsk);

      expect(sent.at(0)?.url).toBe('http://127.0.0.1:4242/v1/chat/completions');
    },
  );

  test('a credentialed grant rides as a bearer header and never enters the body', async () => {
    const sent = await forwarded(aCredentialedGrant(), '/v1/chat/completions', aChatAsk);

    expect(headersSentIn(sent).get('authorization')).toBe('Bearer sk-live-40d1');
    expect(sent.at(0)?.init?.body).not.toContain('sk-live-40d1');
  });

  test('the crossed request names its JSON body for the provider', async () => {
    const sent = await forwarded(anOpenGrant(), '/v1/chat/completions', aChatAsk);

    expect(headersSentIn(sent).get('content-type')).toBe('application/json');
  });

  test('an open grant sends no credential header at all', async () => {
    const sent = await forwarded(anOpenGrant(), '/v1/chat/completions', aChatAsk);

    expect(headersSentIn(sent).get('authorization')).toBeNull();
  });

  test('the outbound fetch is bounded, so provider silence cannot hang a request forever', async () => {
    const sent = await forwarded(aCredentialedGrant(), '/v1/chat/completions', aChatAsk);

    expect(sent.at(0)?.init?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('a request arriving in the Anthropic dialect', () => {
  test('crosses to the chat dialect before it leaves the machine', async () => {
    const sent = await forwarded(aCredentialedGrant(), '/v1/messages', aHubAsk);

    expect(bodySentIn(sent)['model']).toBe('gpt-5-mini');
    expect(bodySentIn(sent)['messages']).toEqual([
      { role: 'system', content: 'Answer briefly.' },
      { role: 'user', content: 'hello' },
    ]);
  });

  test('the caller asking for a stream keeps its ask on the crossed request', async () => {
    const sent = await forwarded(aCredentialedGrant(), '/v1/messages', {
      ...aHubAsk,
      stream: true,
    });

    expect(bodySentIn(sent)['stream']).toBe(true);
  });

  test('a caller not asking for a stream sends no stream ask downstream', async () => {
    const sent = await forwarded(aCredentialedGrant(), '/v1/messages', aHubAsk);

    expect(bodySentIn(sent)['stream']).toBeUndefined();
  });
});

describe('the hub blocks a crossing request may carry', () => {
  test('every hub block kind passes the guard and crosses', async () => {
    const sent = await forwarded(aCredentialedGrant(), '/v1/messages', {
      model: 'fast',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'hello' },
            { type: 'image', source: { type: 'url', url: 'https://images.example/sky.png' } },
            {
              type: 'tool_result',
              toolUseId: 'toolu_1',
              content: [{ type: 'text', text: 'sunny' }],
            },
          ],
        },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'earlier' },
            { type: 'thinking', text: 'quietly' },
            { type: 'redacted_thinking', data: 'aGlkZGVu' },
            { type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: {} },
          ],
        },
      ],
    });

    expect(bodySentIn(sent)['model']).toBe('gpt-5-mini');
  });

  test('an assistant turn in the history crosses with the rest', async () => {
    const sent = await forwarded(aCredentialedGrant(), '/v1/messages', {
      model: 'fast',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'hello' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'earlier answer' }] },
      ],
    });

    expect(bodySentIn(sent)['messages']).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'earlier answer' },
    ]);
  });
});

describe('a request already speaking the target dialect', () => {
  test('passes through whole, keeping every field the caller sent', async () => {
    const sent = await forwarded(aCredentialedGrant(), '/v1/chat/completions', {
      ...aChatAsk,
      stream: true,
      temperature: 0.2,
    });

    expect(bodySentIn(sent)).toEqual({
      model: 'gpt-5-mini',
      messages: [{ role: 'user', content: 'hello' }],
      stream: true,
      temperature: 0.2,
    });
  });

  test('every chat role the dialect knows passes through the guard', async () => {
    const everyRole = [
      { role: 'system', content: 'rules' },
      { role: 'developer', content: 'notes' },
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'earlier' },
      { role: 'tool', tool_call_id: 'call_1', content: 'done' },
    ];

    const sent = await forwarded(aCredentialedGrant(), '/v1/chat/completions', {
      model: 'fast',
      messages: everyRole,
    });

    expect(bodySentIn(sent)['messages']).toEqual(everyRole);
  });
});
