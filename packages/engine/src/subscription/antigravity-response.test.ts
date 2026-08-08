import { expect, test } from 'vitest';

import { unwrapAntigravityResponse } from './antigravity-response';

test('unwraps a non-streaming Gemini response', async () => {
  const wrapped = Response.json({
    response: { candidates: [{ content: { role: 'model', parts: [{ text: 'ok' }] } }] },
  });
  const response = await unwrapAntigravityResponse(wrapped);

  await expect(response.json()).resolves.toEqual({
    candidates: [{ content: { role: 'model', parts: [{ text: 'ok' }] } }],
  });
});

test('TestResolveAntigravityGroundingURLsResolvesVertexRedirects', async () => {
  const redirect = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/example-token';
  const fetchLike: typeof fetch = async (input, init) => {
    expect(urlOf(input)).toBe(redirect);
    expect(init?.method).toBe('HEAD');
    await Promise.resolve();

    return new Response(null, {
      status: 302,
      headers: { location: 'https://example.com/weather' },
    });
  };
  const wrapped = Response.json({
    response: {
      candidates: [
        {
          groundingMetadata: {
            groundingChunks: [
              { web: { uri: redirect, title: 'Weather' } },
              { web: { uri: 'https://already.example/source', title: 'Existing' } },
            ],
          },
        },
      ],
    },
  });
  const response = await unwrapAntigravityResponse(wrapped, fetchLike);

  await expect(response.json()).resolves.toHaveProperty(
    'candidates.0.groundingMetadata.groundingChunks.0.web.uri',
    'https://example.com/weather',
  );
});

test('unwraps fragmented SSE payloads while retaining stream framing', async () => {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"response":{"candidates":[{"content":'));
      controller.enqueue(encoder.encode('{"parts":[{"text":"ok"}]},"finishReason":"STOP"}]}}\n\n'));
      controller.close();
    },
  });
  const response = await unwrapAntigravityResponse(
    new Response(body, { headers: { 'content-type': 'text/event-stream' } }),
  );

  await expect(response.text()).resolves.toBe(
    'data: {"candidates":[{"content":{"parts":[{"text":"ok"}]},"finishReason":"STOP"}]}\n\n',
  );
});

function urlOf(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;

  return input instanceof URL ? input.href : input.url;
}
