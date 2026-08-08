import { describe, expect, test } from 'vitest';

import { chatSseUntilDone } from './chat-sse-hygiene';

function streamOf(chunks: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function drained(chunks: readonly string[]): Promise<string> {
  const decoder = new TextDecoder();
  let text = '';

  for await (const chunk of chatSseUntilDone(streamOf(chunks))) {
    text += decoder.decode(chunk, { stream: true });
  }

  return text;
}

describe('a chat stream that is not server-sent events passes through untouched', () => {
  test('a JSON body reaches the client whole', async () => {
    await expect(drained(['{"id":"chat-1"', ',"object":"chat.completion"}'])).resolves.toBe(
      '{"id":"chat-1","object":"chat.completion"}',
    );
  });

  test('a body that begins like an event but diverges still passes through', async () => {
    await expect(drained(['data-plane report'])).resolves.toBe('data-plane report');
  });

  test('an empty body yields nothing', async () => {
    await expect(drained([])).resolves.toBe('');
  });
});

describe('a chat event stream ends at the first blank line after done', () => {
  test('events before the terminator are delivered', async () => {
    const text = await drained(['data: {"delta":"a"}\n\n', 'data: [DONE]\n\n']);

    expect(text).toContain('data: {"delta":"a"}');
    expect(text).toContain('data: [DONE]');
  });

  test('anything after the terminator is withheld', async () => {
    const text = await drained(['data: [DONE]\n\n', 'data: {"delta":"late"}\n\n']);

    expect(text).not.toContain('late');
  });

  test('a stream split mid-line is reassembled', async () => {
    const text = await drained(['data: {"del', 'ta":"a"}\n\n']);

    expect(text).toContain('data: {"delta":"a"}');
  });

  test('a trailing partial line is flushed when the stream closes', async () => {
    const text = await drained(['data: {"delta":"a"}\n\n', 'data: partial']);

    expect(text).toContain('data: partial');
  });

  test('a carriage return before the blank line still terminates the stream', async () => {
    const text = await drained(['data: [DONE]\r\n\r\n', 'data: {"delta":"late"}\r\n\r\n']);

    expect(text).not.toContain('late');
  });
});
