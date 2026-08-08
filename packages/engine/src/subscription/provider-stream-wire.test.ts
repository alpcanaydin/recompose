import { expect, test } from 'vitest';

import type { ChatStreamFrame } from '../dialect/chat-completions-wire';

import { chatSseBodyFrom, jsonEventsFrom } from '../stream-wire';

function bodyFrom(parts: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const part of parts) {
        controller.enqueue(encoder.encode(part));
      }

      controller.close();
    },
  });
}

async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const held: T[] = [];

  for await (const event of source) {
    held.push(event);
  }

  return held;
}

test('Anthropic and Responses JSON events survive arbitrary stream chunk boundaries', async () => {
  const stream = bodyFrom([
    'event: response.output_text.delta\nda',
    'ta: {"type":"response.output_text.delta","delta":"hel',
    'lo","output_index":0}\n\nevent: response.completed\ndata: {"type":"response.completed","response":{"id":"r1","status":"completed","output":[]}}\n\n',
  ]);

  await expect(collect(jsonEventsFrom(stream))).resolves.toEqual([
    { type: 'response.output_text.delta', delta: 'hello', output_index: 0 },
    { type: 'response.completed', response: { id: 'r1', status: 'completed', output: [] } },
  ]);
});

test('a malformed provider event is carried as unknown without ending the stream', async () => {
  const stream = bodyFrom(['data: not-json\n\ndata: {"type":"message_stop"}\n\ndata: [DONE]\n\n']);

  await expect(collect(jsonEventsFrom(stream))).resolves.toEqual([
    { type: 'unknown' },
    { type: 'message_stop' },
  ]);
});

test('translated Chat Completions frames use data-only SSE and a terminal DONE marker', async () => {
  async function* frames(): AsyncIterable<ChatStreamFrame> {
    await Promise.resolve();

    yield {
      type: 'chunk',
      chunk: {
        choices: [{ index: 0, delta: { content: 'hello' }, finish_reason: null }],
      },
    };
    yield { type: 'done' };
  }

  await expect(new Response(chatSseBodyFrom(frames())).text()).resolves.toBe(
    'data: {"choices":[{"index":0,"delta":{"content":"hello"},"finish_reason":null}]}\n\ndata: [DONE]\n\n',
  );
});
