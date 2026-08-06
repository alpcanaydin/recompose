import { describe, expect, test } from 'vitest';

import { unwrapAntigravityResponse } from './antigravity-response';

describe('opening Antigravity response envelopes', () => {
  test('unwraps a non-streaming Gemini response', async () => {
    const wrapped = Response.json({
      response: { candidates: [{ content: { role: 'model', parts: [{ text: 'ok' }] } }] },
    });
    const response = await unwrapAntigravityResponse(wrapped);

    await expect(response.json()).resolves.toEqual({
      candidates: [{ content: { role: 'model', parts: [{ text: 'ok' }] } }],
    });
  });

  test('unwraps fragmented SSE payloads while retaining stream framing', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"response":{"candidates":[{"content":'));
        controller.enqueue(
          encoder.encode('{"parts":[{"text":"ok"}]},"finishReason":"STOP"}]}}\n\n'),
        );
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
});
