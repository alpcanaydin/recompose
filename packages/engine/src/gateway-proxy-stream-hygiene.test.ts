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

const aWireStreamAsk = {
  model: 'fast',
  max_tokens: 1024,
  stream: true,
  messages: [{ role: 'user', content: 'hello' }],
};

const theCrlfWireEvents = [
  {
    type: 'message_start',
    message: {
      id: 'msg_translated',
      type: 'message',
      role: 'assistant',
      model: 'gpt-5-mini',
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    },
  },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hel' } },
  { type: 'content_block_stop', index: 0 },
  {
    type: 'message_delta',
    delta: { stop_reason: 'end_turn', stop_sequence: null },
    usage: { input_tokens: 0, output_tokens: 0 },
  },
  { type: 'message_stop' },
];

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
    body: JSON.stringify(aWireStreamAsk),
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

    expect(parsedEvents(await readSseData(answer))).toEqual(theCrlfWireEvents);
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

    expect(new TextDecoder().decode(step.value)).toContain('event: message_start');

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

describe('a same-dialect Chat stream after its terminal sentinel', () => {
  test('drops provider chunks that arrive after DONE', async () => {
    const upstream = [
      `data: ${chunkOf('kept')}\n\n`,
      'data: [DONE]\n\n',
      `data: ${chunkOf('dropped')}\n\n`,
    ].join('');
    const provider = new Hono();

    provider.post('/v1/chat/completions', (c) =>
      c.body(upstream, 200, { 'content-type': 'text/event-stream' }),
    );
    running = await servedOrigin(provider);

    const app = createGatewayApp(
      aGatewayHolding(aVirtualModel()),
      async () => Promise.resolve(aCredentialedGrant(running?.origin ?? '')),
      globalThis.fetch,
    );
    const answer = await app.request('http://127.0.0.1:8397/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify(aWireStreamAsk),
    });
    const text = await answer.text();

    expect(text).toContain('kept');
    expect(text).toContain('[DONE]');
    expect(text).not.toContain('dropped');
  });
});
