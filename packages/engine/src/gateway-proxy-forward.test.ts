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

const aWireAsk = {
  model: 'fast',
  max_tokens: 1024,
  system: [{ type: 'text', text: 'Answer briefly.' }],
  messages: [{ role: 'user', content: 'hello' }],
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

  test('an Anthropic key reaches Messages with the vendor key headers', async () => {
    const grant = aCredentialedGrant('https://api.anthropic.com', 'anthropic');
    const sent = await forwarded(grant, '/v1/messages', aWireAsk);

    expect(sent.at(0)?.url).toBe('https://api.anthropic.com/v1/messages');
    expect(headersSentIn(sent).get('x-api-key')).toBe('sk-live-40d1');
    expect(headersSentIn(sent).get('anthropic-version')).toBe('2023-06-01');
    expect(headersSentIn(sent).get('authorization')).toBeNull();
    expect(bodySentIn(sent)).toMatchObject({ model: 'gpt-5-mini', max_tokens: 1024 });
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

describe('a request crossing to Gemini', () => {
  const gemini = aCredentialedGrant('https://generativelanguage.googleapis.com', 'gemini');

  test('uses generateContent and the native key header', async () => {
    const sent = await forwarded(gemini, '/v1/chat/completions', aChatAsk);

    expect(sent.at(0)?.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gpt-5-mini:generateContent',
    );
    expect(headersSentIn(sent).get('x-goog-api-key')).toBe('sk-live-40d1');
    expect(headersSentIn(sent).get('authorization')).toBeNull();
    expect(bodySentIn(sent)['contents']).toEqual([{ role: 'user', parts: [{ text: 'hello' }] }]);
  });

  test('selects streamGenerateContent SSE for a streaming ask', async () => {
    const sent = await forwarded(gemini, '/v1/chat/completions', { ...aChatAsk, stream: true });

    expect(sent.at(0)?.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gpt-5-mini:streamGenerateContent?alt=sse',
    );
  });
});

describe('a request arriving in the Anthropic dialect', () => {
  test('crosses to the chat dialect before it leaves the machine', async () => {
    const sent = await forwarded(aCredentialedGrant(), '/v1/messages', aWireAsk);

    expect(bodySentIn(sent)['model']).toBe('gpt-5-mini');
    expect(bodySentIn(sent)['messages']).toEqual([
      { role: 'system', content: 'Answer briefly.' },
      { role: 'user', content: 'hello' },
    ]);
  });

  test('the wire max_tokens ceiling crosses onto the chat body', async () => {
    const sent = await forwarded(aCredentialedGrant(), '/v1/messages', aWireAsk);

    expect(bodySentIn(sent)['max_tokens']).toBe(1024);
  });

  test('the caller asking for a stream keeps its ask on the crossed request', async () => {
    const sent = await forwarded(aCredentialedGrant(), '/v1/messages', {
      ...aWireAsk,
      stream: true,
    });

    expect(bodySentIn(sent)['stream']).toBe(true);
  });

  test('a caller not asking for a stream sends no stream ask downstream', async () => {
    const sent = await forwarded(aCredentialedGrant(), '/v1/messages', aWireAsk);

    expect(bodySentIn(sent)['stream']).toBeUndefined();
  });
});

describe('the primary client speaks and the gateway serves', () => {
  test('a full Claude Code wire body serves rather than refusing', async () => {
    const sent = await forwarded(aCredentialedGrant(), '/v1/messages', {
      model: 'fast',
      max_tokens: 32000,
      system: [
        { type: 'text', text: 'You are Claude Code.', cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: 'ls the repo' }],
      tools: [
        {
          name: 'bash',
          description: 'Run a command',
          input_schema: {
            type: 'object',
            properties: { command: { type: 'string' } },
            required: ['command'],
          },
        },
      ],
      tool_choice: { type: 'auto' },
      metadata: { user_id: 'session-40d1' },
      temperature: 1,
    });

    const body = bodySentIn(sent);

    expect(body['model']).toBe('gpt-5-mini');
    expect(body['max_tokens']).toBe(32000);
    expect(body['messages']).toEqual([
      { role: 'system', content: 'You are Claude Code.', cache_control: { type: 'ephemeral' } },
      { role: 'user', content: 'ls the repo' },
    ]);
    expect(body['tool_choice']).toBe('auto');
    expect(body['tools']).toEqual([
      {
        type: 'function',
        function: {
          name: 'bash',
          description: 'Run a command',
          parameters: {
            type: 'object',
            properties: { command: { type: 'string' } },
            required: ['command'],
          },
        },
      },
    ]);
  });
});

describe('the wire blocks a crossing request may carry', () => {
  test('every wire block kind passes the guard and crosses', async () => {
    const sent = await forwarded(aCredentialedGrant(), '/v1/messages', {
      model: 'fast',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'hello' },
            { type: 'image', source: { type: 'url', url: 'https://images.example/sky.png' } },
            {
              type: 'tool_result',
              tool_use_id: 'toolu_1',
              content: [{ type: 'text', text: 'sunny' }],
            },
          ],
        },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'earlier' },
            { type: 'thinking', thinking: 'quietly' },
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
      max_tokens: 1024,
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'earlier answer' },
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
