import { expect, test } from 'vitest';

import { KimiStreamReplayAccumulator } from './kimi-stream-replay';

const REPLAY_BUDGET = 8 * 1024 * 1024;

function replaying(events: readonly unknown[]): KimiStreamReplayAccumulator {
  const accumulator = new KimiStreamReplayAccumulator();

  for (const event of events) accumulator.observeLine(`data: ${JSON.stringify(event)}`);

  return accumulator;
}

function overBudgetText(): string {
  return 'a'.repeat(REPLAY_BUDGET + 1);
}

function textBlockStart(text: string): unknown {
  return { type: 'content_block_start', index: 0, content_block: { type: 'text', text } };
}

function toolBlockStart(): unknown {
  return {
    type: 'content_block_start',
    index: 0,
    content_block: { type: 'tool_use', id: 'toolu_1', name: 'Read', input: {} },
  };
}

test('abandons a content block whose opening part already exceeds the replay budget', () => {
  const accumulator = replaying([{ type: 'message_start' }, textBlockStart(overBudgetText())]);

  expect(accumulator.abandoned).toBe(true);
  expect(accumulator.content()).toBeUndefined();
});

test('abandons a text delta that exceeds the replay budget', () => {
  const accumulator = replaying([
    { type: 'message_start' },
    textBlockStart(''),
    {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: overBudgetText() },
    },
  ]);

  expect(accumulator.abandoned).toBe(true);
});

test('abandons a tool input delta that exceeds the replay budget', () => {
  const accumulator = replaying([
    { type: 'message_start' },
    toolBlockStart(),
    {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'input_json_delta', partial_json: overBudgetText() },
    },
  ]);

  expect(accumulator.abandoned).toBe(true);
});

test('ignores a stream event that names no block lifecycle it knows', () => {
  const accumulator = replaying([
    { type: 'message_start' },
    { type: 'ping' },
    textBlockStart('hello'),
    { type: 'content_block_stop', index: 0 },
    { type: 'message_stop' },
  ]);

  expect(accumulator.abandoned).toBe(false);
  expect(accumulator.content()).toEqual([{ type: 'text', text: 'hello' }]);
});

test('withholds content whose serialized form outgrows the replay budget', () => {
  const escaping = '"'.repeat(REPLAY_BUDGET / 2);
  const accumulator = replaying([
    { type: 'message_start' },
    textBlockStart(''),
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: escaping } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_stop' },
  ]);

  expect(accumulator.abandoned).toBe(false);
  expect(accumulator.content()).toBeUndefined();
});
