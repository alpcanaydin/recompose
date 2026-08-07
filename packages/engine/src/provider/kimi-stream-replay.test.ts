import { expect, test } from 'vitest';

import { KimiStreamReplayAccumulator } from './kimi-stream-replay';

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
