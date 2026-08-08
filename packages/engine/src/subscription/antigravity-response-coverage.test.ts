import { describe, expect, test } from 'vitest';

import { unwrapAntigravityResponse } from './antigravity-response';

const REDIRECT = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/token';

function neverRedirecting(): typeof fetch {
  return async () => {
    await Promise.resolve();

    return new Response(null, { status: 200 });
  };
}

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function grounded(chunks: unknown): Response {
  return Response.json({
    response: { candidates: [{ groundingMetadata: { groundingChunks: chunks } }] },
  });
}

describe('unwrapping a body that is not a wrapped Gemini response', () => {
  test('a body that is not an object is handed back as it arrived', async () => {
    const response = await unwrapAntigravityResponse(new Response('plain text'));

    await expect(response.text()).resolves.toBe('plain text');
  });
});

describe('resolving the grounding links a Vertex answer points at', () => {
  test('a redirect that does not redirect leaves the link as it was', async () => {
    const response = await unwrapAntigravityResponse(
      grounded([{ web: { uri: REDIRECT } }]),
      neverRedirecting(),
    );

    await expect(response.json()).resolves.toHaveProperty(
      'candidates.0.groundingMetadata.groundingChunks.0.web.uri',
      REDIRECT,
    );
  });

  test('chunks that name no web link at all are carried through untouched', async () => {
    const chunks = ['not-a-chunk', { retrievedContext: {} }, { web: { uri: 42 } }];
    const response = await unwrapAntigravityResponse(grounded(chunks), neverRedirecting());

    await expect(response.json()).resolves.toHaveProperty(
      'candidates.0.groundingMetadata.groundingChunks',
      chunks,
    );
  });

  test('grounding metadata listing no chunks is carried through untouched', async () => {
    const wrapped = Response.json({
      response: { candidates: [{ groundingMetadata: { webSearchQueries: ['weather'] } }] },
    });
    const response = await unwrapAntigravityResponse(wrapped, neverRedirecting());

    await expect(response.json()).resolves.toStrictEqual({
      candidates: [{ groundingMetadata: { webSearchQueries: ['weather'] } }],
    });
  });
});

describe('unwrapping a streamed answer', () => {
  test('a final line that never ends is still unwrapped and forwarded', async () => {
    const wrapped = new Response(streamOf('data: {"response":{"candidates":[]}}'), {
      headers: { 'content-type': 'text/event-stream' },
    });
    const response = await unwrapAntigravityResponse(wrapped);

    await expect(response.text()).resolves.toBe('data: {"candidates":[]}');
  });

  test('an event stream that carries no body stays empty', async () => {
    const wrapped = new Response(null, {
      status: 204,
      headers: { 'content-type': 'text/event-stream' },
    });
    const response = await unwrapAntigravityResponse(wrapped);

    expect(response.body).toBeNull();
    expect(response.status).toBe(204);
  });
});
