import { Hono } from 'hono';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { RunningOrigin } from './gateway-app.testkit';

import { createGatewayApp } from './gateway-app';
import {
  aCredentialedGrant,
  aGatewayHolding,
  aHeldStream,
  aVirtualModel,
  parsedEvents,
  readSseData,
  servedOrigin,
} from './gateway-app.testkit';

function chunkOf(content: string): string {
  return JSON.stringify({ choices: [{ index: 0, delta: { content } }] });
}

const aHubStreamAsk = {
  model: 'fast',
  stream: true,
  messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
};

function bodyOf(response: Response): ReadableStream<Uint8Array> {
  if (response.body === null) {
    throw new Error('the streamed answer carried no body');
  }

  return response.body;
}

let running: RunningOrigin | undefined;

afterEach(async () => {
  await running?.close();
  running = undefined;
});

async function askStreaming(origin: string, fetchLike?: typeof fetch): Promise<Response> {
  const app = createGatewayApp(
    aGatewayHolding(aVirtualModel()),
    async () => Promise.resolve(aCredentialedGrant(origin)),
    fetchLike ?? globalThis.fetch,
  );

  return app.request('http://127.0.0.1:8397/v1/messages', {
    method: 'POST',
    body: JSON.stringify(aHubStreamAsk),
  });
}

describe('a CRLF-framed upstream stream', () => {
  test('crosses whole and ends clean, like its LF twin', async () => {
    const finishChunk = JSON.stringify({
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    });
    const crlf = [`data: ${chunkOf('Hel')}`, `data: ${finishChunk}`, 'data: [DONE]']
      .map((line) => `${line}\r\n\r\n`)
      .join('');
    const provider = new Hono();

    provider.post('/v1/chat/completions', (c) =>
      c.body(crlf, 200, { 'content-type': 'text/event-stream' }),
    );
    running = await servedOrigin(provider);

    const answer = await askStreaming(running.origin);

    expect(parsedEvents(await readSseData(answer))).toEqual([
      { type: 'message-begin' },
      { type: 'block-open', index: 0, opening: { kind: 'text' } },
      { type: 'block-delta', index: 0, delta: { kind: 'text', text: 'Hel' } },
      { type: 'block-close', index: 0 },
      { type: 'message-end', stopReason: 'end', usage: {} },
    ]);
  });

  test('the first CRLF event reaches the caller while the provider still streams', async () => {
    const held = aHeldStream();
    const provider = new Hono();

    provider.post('/v1/chat/completions', (c) =>
      c.body(held.stream, 200, { 'content-type': 'text/event-stream' }),
    );
    running = await servedOrigin(provider);
    held.send(`data: ${chunkOf('first')}\r\n\r\n`);

    const answer = await askStreaming(running.origin);
    const reader = bodyOf(answer).getReader();
    const step = await reader.read();

    if (step.done) {
      throw new Error('the streamed answer ended before its first event');
    }

    expect(new TextDecoder().decode(step.value)).toContain('message-begin');

    held.send('data: [DONE]\r\n\r\n');
    held.end();
    await reader.cancel();
  });
});

describe('a caller abandoning the stream', () => {
  test('cancels the upstream read at the provider boundary', async () => {
    const encoder = new TextEncoder();
    let upstreamCancelled = false;

    const upstreamBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${chunkOf('first')}\n\n`));
      },
      cancel() {
        upstreamCancelled = true;
      },
    });

    const answer = await askStreaming('http://127.0.0.1:4242', async () =>
      Promise.resolve(
        new Response(upstreamBody, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
      ),
    );
    const reader = bodyOf(answer).getReader();

    await reader.read();
    await reader.cancel();

    await vi.waitFor(() => {
      expect(upstreamCancelled).toBe(true);
    });
  });
});
