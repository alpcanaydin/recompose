import { describe, expect, it } from 'vitest';

import { createGatewayApp } from './gateway-app';
import {
  aCredentialedGrant,
  aGatewayHolding,
  aVirtualModel,
  bodySentIn,
  fetchAnsweringWith,
} from './gateway-app.testkit';

function chatAnswer(): Response {
  return Response.json({
    id: 'chatcmpl_1',
    model: 'gpt-5-mini',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'hello back' },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
  });
}

function chatStream(): Response {
  const events = [
    {
      id: 'chatcmpl_1',
      model: 'gpt-5-mini',
      choices: [{ index: 0, delta: { content: 'hello' }, finish_reason: null }],
    },
    {
      id: 'chatcmpl_1',
      model: 'gpt-5-mini',
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    },
    {
      id: 'chatcmpl_1',
      model: 'gpt-5-mini',
      choices: [],
      usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
    },
  ];
  const body = [...events.map((event) => `data: ${JSON.stringify(event)}\n\n`), 'data: [DONE]\n\n'];

  return new Response(body.join(''), { headers: { 'content-type': 'text/event-stream' } });
}

function appFor(fetchLike: typeof fetch) {
  return createGatewayApp(
    aGatewayHolding(aVirtualModel()),
    async () => Promise.resolve(aCredentialedGrant()),
    fetchLike,
  );
}

describe('native Gemini generateContent serving', () => {
  it('should route the path model and translate the completed answer', async () => {
    const upstream = fetchAnsweringWith(chatAnswer);
    const answer = await appFor(upstream.fetchLike).request(
      'http://127.0.0.1:8397/v1beta/models/fast:generateContent',
      {
        method: 'POST',
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'hello' }] }] }),
      },
    );

    expect(answer.status).toBe(200);
    expect(upstream.sent[0]?.url).toBe('http://127.0.0.1:4242/v1/chat/completions');
    expect(bodySentIn(upstream.sent)).toMatchObject({
      model: 'gpt-5-mini',
      messages: [{ role: 'user', content: 'hello' }],
    });
    await expect(answer.json()).resolves.toMatchObject({
      candidates: [
        { content: { role: 'model', parts: [{ text: 'hello back' }] }, finishReason: 'STOP' },
      ],
      usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 3, totalTokenCount: 5 },
    });
  });
});

describe('native Gemini streamGenerateContent serving', () => {
  it('should force streaming and answer with native Gemini SSE chunks', async () => {
    const upstream = fetchAnsweringWith(chatStream);
    const answer = await appFor(upstream.fetchLike).request(
      'http://127.0.0.1:8397/v1beta/models/fast:streamGenerateContent?alt=sse',
      {
        method: 'POST',
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'hello' }] }] }),
      },
    );
    const text = await answer.text();

    expect(bodySentIn(upstream.sent)).toHaveProperty('stream', true);
    expect(answer.headers.get('content-type')).toContain('text/event-stream');
    expect(text).toContain('"parts":[{"text":"hello"}]');
    expect(text).toContain('"finishReason":"STOP"');
    expect(text).toContain('"totalTokenCount":3');
  });
});
