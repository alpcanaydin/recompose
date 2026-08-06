import { describe, expect, test } from 'vitest';

import { createGatewayApp } from './gateway-app';
import { aCredentialedGrant, aGatewayHolding, aVirtualModel } from './gateway-app.testkit';

const grant = aCredentialedGrant('https://generativelanguage.googleapis.com', 'gemini');

function urlOf(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;

  return input instanceof URL ? input.href : input.url;
}

function geminiResponse(): Response {
  return Response.json({
    candidates: [
      {
        content: { role: 'model', parts: [{ text: 'selam' }] },
        finishReason: 'STOP',
      },
    ],
    usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2, totalTokenCount: 5 },
  });
}

function geminiStream(): Response {
  const frames = [
    { candidates: [{ content: { role: 'model', parts: [{ text: 'se' }] } }] },
    {
      candidates: [{ content: { role: 'model', parts: [{ text: 'lam' }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 },
    },
  ];
  const body = frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join('');

  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
}

async function ask(fetchLike: typeof fetch, stream = false): Promise<Response> {
  const app = createGatewayApp(
    aGatewayHolding(aVirtualModel()),
    async () => Promise.resolve(grant),
    fetchLike,
  );

  return app.request('http://127.0.0.1:8397/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: 'fast',
      messages: [{ role: 'user', content: 'hello' }],
      stream,
    }),
  });
}

describe('Gemini provider serving', () => {
  test('translates a generateContent answer back to Chat Completions', async () => {
    const answer = await ask(async () => Promise.resolve(geminiResponse()));
    const body: unknown = await answer.json();

    expect(body).toMatchObject({
      choices: [{ message: { role: 'assistant', content: 'selam' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 3, completion_tokens: 2 },
    });
  });

  test('translates generateContent SSE and terminates the chat stream', async () => {
    const answer = await ask(async () => Promise.resolve(geminiStream()), true);
    const body = await answer.text();

    expect(body).toContain('"content":"se"');
    expect(body).toContain('"content":"lam"');
    expect(body).toContain('data: [DONE]');
  });

  test('uses native countTokens for an Anthropic count request', async () => {
    const sent: string[] = [];
    const fetchLike: typeof fetch = async (input) => {
      sent.push(urlOf(input));

      return Promise.resolve(Response.json({ totalTokens: 17 }));
    };
    const app = createGatewayApp(
      aGatewayHolding(aVirtualModel()),
      async () => Promise.resolve(grant),
      fetchLike,
    );
    const answer = await app.request('http://127.0.0.1:8397/v1/messages/count_tokens', {
      method: 'POST',
      body: JSON.stringify({ model: 'fast', messages: [{ role: 'user', content: 'hello' }] }),
    });

    expect(sent).toEqual([
      'https://generativelanguage.googleapis.com/v1beta/models/gpt-5-mini:countTokens',
    ]);
    expect(await answer.json()).toEqual({ input_tokens: 17 });
  });
});
