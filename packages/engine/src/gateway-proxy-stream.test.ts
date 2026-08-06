import { Hono } from 'hono';
import { afterEach, describe, expect, test } from 'vitest';

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
  sseText,
} from './gateway-app.testkit';

function chunkOf(content: string): string {
  return JSON.stringify({ choices: [{ index: 0, delta: { content } }] });
}

const finishChunk = JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });

function anSseProvider(text: string): Hono {
  const app = new Hono();

  app.post('/v1/chat/completions', (c) =>
    c.body(text, 200, { 'content-type': 'text/event-stream' }),
  );

  return app;
}

let running: RunningOrigin | undefined;

afterEach(async () => {
  await running?.close();
  running = undefined;
});

async function askStreaming(origin: string, path: string, body: unknown): Promise<Response> {
  const app = createGatewayApp(aGatewayHolding(aVirtualModel()), async () =>
    Promise.resolve(aCredentialedGrant(origin)),
  );

  return app.request(`http://127.0.0.1:8397${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const aHubStreamAsk = {
  model: 'fast',
  stream: true,
  messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
};

const aChatStreamAsk = {
  model: 'fast',
  stream: true,
  messages: [{ role: 'user', content: 'hello' }],
};

function bodyOf(response: Response): ReadableStream<Uint8Array> {
  if (response.body === null) {
    throw new Error('the streamed answer carried no body');
  }

  return response.body;
}

describe('a streamed answer crossing back to an Anthropic caller', () => {
  test('arrives as hub events in order and ends clean', async () => {
    running = await servedOrigin(
      anSseProvider(sseText([chunkOf('Hel'), chunkOf('lo'), finishChunk, '[DONE]'])),
    );

    const answer = await askStreaming(running.origin, '/v1/messages', aHubStreamAsk);

    expect(answer.headers.get('content-type')).toContain('text/event-stream');
    expect(parsedEvents(await readSseData(answer))).toEqual([
      { type: 'message-begin' },
      { type: 'block-open', index: 0, opening: { kind: 'text' } },
      { type: 'block-delta', index: 0, delta: { kind: 'text', text: 'Hel' } },
      { type: 'block-delta', index: 0, delta: { kind: 'text', text: 'lo' } },
      { type: 'block-close', index: 0 },
      { type: 'message-end', stopReason: 'end', usage: {} },
    ]);
  });

  test('names the virtual model and target on the streamed answer', async () => {
    running = await servedOrigin(anSseProvider(sseText([chunkOf('hi'), finishChunk, '[DONE]'])));

    const answer = await askStreaming(running.origin, '/v1/messages', aHubStreamAsk);

    expect(answer.headers.get('x-recompose-virtual-model')).toBe('fast');
    expect(answer.headers.get('x-recompose-target')).toBe('gpt-5-mini');
  });

  test('noise between frames neither breaks the stream nor leaks into it', async () => {
    const noisy = [
      ': keep-alive\n',
      'event: ping\n',
      'ping: [DONE]\n',
      'data: not-json\n\n',
      'data: {"error":"flat"}\n\n',
      'data: {"error":{"code":5}}\n\n',
      'data: {"choices":"x"}\n\n',
      'data: {"choices":[{"index":0}]}\n\n',
      'data: {"choices":[42,{"delta":{}}]}\n\n',
      `data:${chunkOf('kept')}\n\n`,
      sseText([finishChunk, '[DONE]']),
    ].join('');

    running = await servedOrigin(anSseProvider(noisy));

    const answer = await askStreaming(running.origin, '/v1/messages', aHubStreamAsk);

    expect(parsedEvents(await readSseData(answer))).toEqual([
      { type: 'message-begin' },
      { type: 'block-open', index: 0, opening: { kind: 'text' } },
      { type: 'block-delta', index: 0, delta: { kind: 'text', text: 'kept' } },
      { type: 'block-close', index: 0 },
      { type: 'message-end', stopReason: 'end', usage: {} },
    ]);
  });
});

describe('an upstream failure mid-stream', () => {
  test('crosses as a terminal error event', async () => {
    const dyingStream = `data: ${chunkOf('kept')}\n\ndata: {"error":{"message":"overloaded","type":"overloaded_error"}}`;

    running = await servedOrigin(anSseProvider(dyingStream));

    const answer = await askStreaming(running.origin, '/v1/messages', aHubStreamAsk);

    expect(parsedEvents(await readSseData(answer))).toEqual([
      { type: 'message-begin' },
      { type: 'block-open', index: 0, opening: { kind: 'text' } },
      { type: 'block-delta', index: 0, delta: { kind: 'text', text: 'kept' } },
      { type: 'stream-error', error: { type: 'overloaded_error', message: 'overloaded' } },
    ]);
  });

  test('a failure naming no type still crosses as an error', async () => {
    running = await servedOrigin(anSseProvider('data: {"error":{"message":"burned"}}\n\n'));

    const answer = await askStreaming(running.origin, '/v1/messages', aHubStreamAsk);

    expect(parsedEvents(await readSseData(answer))).toEqual([
      { type: 'stream-error', error: { type: 'error', message: 'burned' } },
    ]);
  });
});

describe('a streamed answer already speaking the caller dialect', () => {
  test('passes through byte for byte', async () => {
    const upstream = sseText([chunkOf('Hel'), chunkOf('lo'), finishChunk, '[DONE]']);

    running = await servedOrigin(anSseProvider(upstream));

    const answer = await askStreaming(running.origin, '/v1/chat/completions', aChatStreamAsk);

    expect(answer.headers.get('content-type')).toContain('text/event-stream');
    expect(await answer.text()).toBe(upstream);
  });
});

describe('a stream the network splits mid-character', () => {
  test('a frame cut inside a multibyte character still decodes whole', async () => {
    const held = aHeldStream();
    const provider = new Hono();

    provider.post('/v1/chat/completions', (c) =>
      c.body(held.stream, 200, { 'content-type': 'text/event-stream' }),
    );
    running = await servedOrigin(provider);

    const line = new TextEncoder().encode(`data: ${chunkOf('café')}\n\n`);
    const cutAt = line.findIndex((byte) => byte >= 0x80) + 1;

    held.sendBytes(line.slice(0, cutAt));
    held.sendBytes(line.slice(cutAt));
    held.send('data: [DONE]\n\n');
    held.end();

    const answer = await askStreaming(running.origin, '/v1/messages', aHubStreamAsk);

    expect(parsedEvents(await readSseData(answer))).toEqual([
      { type: 'message-begin' },
      { type: 'block-open', index: 0, opening: { kind: 'text' } },
      { type: 'block-delta', index: 0, delta: { kind: 'text', text: 'café' } },
      { type: 'block-close', index: 0 },
      { type: 'message-end', stopReason: 'end', usage: {} },
    ]);
  });
});

describe('the gateway never buffers a stream', () => {
  test('the first event reaches the caller while the provider still holds the stream open', async () => {
    const held = aHeldStream();
    const provider = new Hono();

    provider.post('/v1/chat/completions', (c) =>
      c.body(held.stream, 200, { 'content-type': 'text/event-stream' }),
    );
    running = await servedOrigin(provider);
    held.send(`data: ${chunkOf('first')}\n\n`);

    const answer = await askStreaming(running.origin, '/v1/messages', aHubStreamAsk);
    const reader = bodyOf(answer).getReader();
    const step = await reader.read();

    if (step.done) {
      throw new Error('the streamed answer ended before its first event');
    }

    expect(new TextDecoder().decode(step.value)).toContain('message-begin');

    held.send('data: [DONE]\n\n');
    held.end();
    await reader.cancel();
  });

  test('an upstream connection dying mid-stream ends the answer as an error', async () => {
    const held = aHeldStream();
    const provider = new Hono();

    provider.post('/v1/chat/completions', (c) =>
      c.body(held.stream, 200, { 'content-type': 'text/event-stream' }),
    );
    running = await servedOrigin(provider);
    held.send(`data: ${chunkOf('kept')}\n\n`);

    const answer = await askStreaming(running.origin, '/v1/messages', aHubStreamAsk);

    held.die();

    await expect(answer.text()).rejects.toThrow();
  });
});
