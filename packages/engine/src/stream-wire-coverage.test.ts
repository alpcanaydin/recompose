import { describe, expect, test } from 'vitest';

import type { ChatStreamFrame } from './dialect/chat-completions-wire';

import {
  chatSseBodyFrom,
  interactionEventsFrom,
  interactionSseBodyFrom,
  jsonObjectsFrom,
  transformingSseLines,
} from './stream-wire';

async function* streamed<Value>(values: readonly Value[]): AsyncIterable<Value> {
  await Promise.resolve();

  for (const value of values) yield value;
}

function bodyOf(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

async function textOf(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(stream).text();
}

test('writes interaction events as named SSE frames', async () => {
  const events = [{ event_type: 'turn.started' }, { event_type: 'turn.completed' }];

  await expect(textOf(interactionSseBodyFrom(streamed(events)))).resolves.toBe(
    'event: turn.started\ndata: {"event_type":"turn.started"}\n\n' +
      'event: turn.completed\ndata: {"event_type":"turn.completed"}\n\n',
  );
});

test('finishes the interaction source when the reader cancels early', async () => {
  const finished: string[] = [];
  const events = async function* (): AsyncIterable<{ event_type: string }> {
    try {
      await Promise.resolve();
      yield { event_type: 'turn.started' };
      yield { event_type: 'turn.completed' };
    } finally {
      finished.push('closed');
    }
  };
  const reader = interactionSseBodyFrom(events()).getReader();

  await reader.read();
  await reader.cancel();

  expect(finished).toEqual(['closed']);
});

test('finishes the chat frame source when the reader cancels early', async () => {
  const finished: string[] = [];
  const frames = async function* (): AsyncIterable<ChatStreamFrame> {
    try {
      await Promise.resolve();
      yield { type: 'done' };
    } finally {
      finished.push('closed');
    }
  };
  const reader = chatSseBodyFrom(frames()).getReader();

  await reader.read();
  await reader.cancel();

  expect(finished).toEqual(['closed']);
});

test('omits frames it cannot render from the chat SSE body', async () => {
  const frames: ChatStreamFrame[] = [{ type: 'unknown' }, { type: 'done' }];

  await expect(textOf(chatSseBodyFrom(streamed(frames)))).resolves.toBe('data: [DONE]\n\n');
});

test('fails the chat SSE body when the frame source fails', async () => {
  const frames = async function* (): AsyncIterable<ChatStreamFrame> {
    await Promise.resolve();

    yield { type: 'done' };

    throw new Error('frame source failed');
  };
  const reader = chatSseBodyFrom(frames()).getReader();

  await reader.read();

  await expect(reader.read()).rejects.toThrow('frame source failed');
});

test('transforms a trailing line that arrives without a newline', async () => {
  const stream = transformingSseLines(bodyOf('data: one\ndata: two'), (line) => line.toUpperCase());

  await expect(textOf(stream)).resolves.toBe('DATA: ONE\nDATA: TWO');
});

function sseBodyOf(...payloads: readonly string[]): ReadableStream<Uint8Array> {
  return bodyOf(payloads.map((payload) => `data: ${payload}\n\n`).join(''));
}

async function collected<Value>(source: AsyncIterable<Value>): Promise<Value[]> {
  const items: Value[] = [];

  for await (const item of source) items.push(item);

  return items;
}

describe('reading JSON objects off an event stream', () => {
  test('a payload that parses to something other than an object is skipped', async () => {
    const objects = await collected(jsonObjectsFrom(sseBodyOf('42', '"text"', '[1,2]', 'null')));

    expect(objects).toEqual([]);
  });

  test('a payload that is not JSON at all is skipped', async () => {
    const objects = await collected(jsonObjectsFrom(sseBodyOf('not json', '{"id":"resp_1"}')));

    expect(objects).toEqual([{ id: 'resp_1' }]);
  });

  test('the terminating sentinel and non-data lines are skipped', async () => {
    const body = bodyOf('event: ping\ndata: {"id":"resp_1"}\n\ndata: [DONE]\n\n');

    await expect(collected(jsonObjectsFrom(body))).resolves.toEqual([{ id: 'resp_1' }]);
  });
});

describe('reading interaction events off an event stream', () => {
  test('an event naming its type is handed on with that type', async () => {
    const body = sseBodyOf('{"event_type":"turn.start","seq":1}');

    await expect(collected(interactionEventsFrom(body))).resolves.toEqual([
      { event_type: 'turn.start', seq: 1 },
    ]);
  });

  test('an object that names no event type is skipped', async () => {
    const body = sseBodyOf('{"seq":1}', '{"event_type":7}', '{"event_type":"turn.end"}');

    await expect(collected(interactionEventsFrom(body))).resolves.toEqual([
      { event_type: 'turn.end' },
    ]);
  });
});
