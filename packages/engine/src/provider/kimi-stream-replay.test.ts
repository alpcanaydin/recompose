import { expect, test } from 'vitest';

import { KimiStreamReplayAccumulator } from './kimi-stream-replay';

function replayingLines(lines: readonly string[]): KimiStreamReplayAccumulator {
  const accumulator = new KimiStreamReplayAccumulator();

  for (const line of lines) accumulator.observeLine(line);

  return accumulator;
}

function dataLines(events: readonly unknown[]): string[] {
  return events.map((event) => `data: ${JSON.stringify(event)}`);
}

function replaying(events: readonly unknown[]): KimiStreamReplayAccumulator {
  return replayingLines(dataLines(events));
}

function messageStart(): unknown {
  return { type: 'message_start' };
}

function messageStop(): unknown {
  return { type: 'message_stop' };
}

function textBlockStart(index: number): unknown {
  return { type: 'content_block_start', index, content_block: { type: 'text', text: '' } };
}

function toolBlockStart(index: number): unknown {
  return {
    type: 'content_block_start',
    index,
    content_block: { type: 'tool_use', id: 'toolu_1', name: 'Read', input: {} },
  };
}

function completedTextStream(): unknown[] {
  return [
    messageStart(),
    textBlockStart(0),
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'hi' } },
    { type: 'content_block_stop', index: 0 },
    messageStop(),
  ];
}

test('reconstructs signed Kimi content from a completed stream', () => {
  const accumulator = new KimiStreamReplayAccumulator();
  const events = [
    { type: 'message_start', message: { id: 'msg_1' } },
    { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
    {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'thinking_delta', thinking: 'reasoning' },
    },
    {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'signature_delta', signature: 'signature' },
    },
    { type: 'content_block_stop', index: 0 },
    {
      type: 'content_block_start',
      index: 1,
      content_block: { type: 'tool_use', id: 'toolu_1', name: 'Read', input: {} },
    },
    {
      type: 'content_block_delta',
      index: 1,
      delta: { type: 'input_json_delta', partial_json: '{"path":"README.md"}' },
    },
    { type: 'content_block_stop', index: 1 },
    { type: 'message_stop' },
  ];

  for (const event of events) accumulator.observeLine(`data: ${JSON.stringify(event)}`);

  expect(accumulator.content()).toEqual([
    { type: 'thinking', thinking: 'reasoning', signature: 'signature' },
    { type: 'tool_use', id: 'toolu_1', name: 'Read', input: { path: 'README.md' } },
  ]);
});

test('abandons unknown Kimi deltas without producing replacement content', () => {
  const accumulator = new KimiStreamReplayAccumulator();

  accumulator.observeLine('data: {"type":"message_start"}');
  accumulator.observeLine(
    'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
  );
  accumulator.observeLine(
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"future_delta"}}',
  );
  accumulator.observeLine('data: {"type":"message_stop"}');

  expect(accumulator.abandoned).toBe(true);
  expect(accumulator.content()).toBeUndefined();
});

test('replays a stream that carries keep-alive, blank and terminator lines', () => {
  const noise = [': keep-alive', 'data:', 'data:   ', 'data: [DONE]'];
  const accumulator = replayingLines([...noise, ...dataLines(completedTextStream())]);

  expect(accumulator.content()).toEqual([{ type: 'text', text: 'hi' }]);
});

test('abandons a stream whose data payload is not a JSON object', () => {
  const accumulator = replayingLines([...dataLines([messageStart()]), 'data: not-json']);

  expect(accumulator.abandoned).toBe(true);
  expect(accumulator.content()).toBeUndefined();
});

test('withholds content while a content block is still open', () => {
  const accumulator = replaying([messageStart(), textBlockStart(0), messageStop()]);

  expect(accumulator.abandoned).toBe(false);
  expect(accumulator.content()).toBeUndefined();
});

test('records an upstream error event and withholds content', () => {
  const failure = { type: 'error', error: { message: 'overloaded' } };
  const accumulator = replaying([messageStart(), failure, messageStop()]);

  expect(accumulator.upstreamError).toBe(true);
  expect(accumulator.content()).toBeUndefined();
});

test('abandons a content block start that names no block index', () => {
  const orphan = { type: 'content_block_start', content_block: { type: 'text', text: '' } };

  expect(replaying([messageStart(), orphan]).abandoned).toBe(true);
});

test('abandons a content block start that repeats an open index', () => {
  const accumulator = replaying([messageStart(), textBlockStart(0), textBlockStart(0)]);

  expect(accumulator.abandoned).toBe(true);
});

test('abandons a stream that opens more blocks than the replay holds', () => {
  const starts = Array.from({ length: 513 }, (_value, index) => textBlockStart(index));

  expect(replaying([messageStart(), ...starts]).abandoned).toBe(true);
});

test('abandons a delta that names no open content block', () => {
  const orphan = { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hi' } };

  expect(replaying([messageStart(), orphan]).abandoned).toBe(true);
});

test('abandons a delta whose payload is not an object', () => {
  const scalar = { type: 'content_block_delta', index: 0, delta: 'text' };

  expect(replaying([messageStart(), textBlockStart(0), scalar]).abandoned).toBe(true);
});

test('abandons a delta whose type is not a string', () => {
  const numbered = { type: 'content_block_delta', index: 0, delta: { type: 7 } };

  expect(replaying([messageStart(), textBlockStart(0), numbered]).abandoned).toBe(true);
});

test('abandons a tool block whose streamed input never forms an object', () => {
  const accumulator = replaying([
    messageStart(),
    toolBlockStart(0),
    { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta' } },
    { type: 'content_block_stop', index: 0 },
    messageStop(),
  ]);

  expect(accumulator.abandoned).toBe(true);
  expect(accumulator.content()).toBeUndefined();
});

test('treats a text delta carrying a non-string value as empty text', () => {
  const accumulator = replaying([
    messageStart(),
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: 'seen' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 7 } },
    { type: 'content_block_stop', index: 0 },
    messageStop(),
  ]);

  expect(accumulator.content()).toEqual([{ type: 'text', text: 'seen' }]);
});

test('abandons a content block stop that names no open block', () => {
  const accumulator = replaying([messageStart(), { type: 'content_block_stop' }]);

  expect(accumulator.abandoned).toBe(true);
});
