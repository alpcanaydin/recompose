import { describe, expect, it } from 'vitest';

import type { ResponsesStreamEvent } from './responses-wire';

import { decodeStream } from './responses-codec';
import { aResponsesToolCallStream, collect, streamOf } from './responses.testkit';

async function decode(events: readonly ResponsesStreamEvent[]) {
  return collect(decodeStream(streamOf(events)));
}

describe('decodeStream: block opens carry their kind, index, and identity', () => {
  it('keeps the tool name and id on the block open of a streamed tool call', async () => {
    const events = await decode(aResponsesToolCallStream());

    expect(events).toContainEqual({
      type: 'block-open',
      index: 0,
      opening: { kind: 'tool', id: 'call_weather', name: 'get_weather' },
    });
  });

  it('gives the text block and the tool block their own correct indices', async () => {
    const events = await decode([
      {
        type: 'response.output_item.added',
        output_index: 0,
        item: { type: 'message', role: 'assistant' },
      },
      { type: 'response.output_text.delta', output_index: 0, delta: 'Hi' },
      {
        type: 'response.output_item.added',
        output_index: 1,
        item: { type: 'function_call', call_id: 'call_x', name: 'lookup' },
      },
    ]);

    expect(events).toContainEqual({ type: 'block-open', index: 0, opening: { kind: 'text' } });
    expect(events).toContainEqual({
      type: 'block-delta',
      index: 0,
      delta: { kind: 'text', text: 'Hi' },
    });
    expect(events).toContainEqual({
      type: 'block-open',
      index: 1,
      opening: { kind: 'tool', id: 'call_x', name: 'lookup' },
    });
  });

  it('reads a streamed reasoning item as a thinking block open', async () => {
    const events = await decode([
      {
        type: 'response.output_item.added',
        output_index: 0,
        item: { type: 'reasoning', id: 'rs_1' },
      },
    ]);

    expect(events).toContainEqual({ type: 'block-open', index: 0, opening: { kind: 'thinking' } });
  });
});

describe('decodeStream: an absent tool id is synthesized deterministically', () => {
  it('synthesizes a stable tool id from the item id when the call id is absent', async () => {
    const events = await decode([
      {
        type: 'response.output_item.added',
        output_index: 0,
        item: { type: 'function_call', id: 'fc_1', name: 'lookup' },
      },
    ]);

    expect(events).toContainEqual({
      type: 'block-open',
      index: 0,
      opening: { kind: 'tool', id: 'fc_1', name: 'lookup' },
    });
  });

  it('synthesizes a stable tool id from the index when the upstream omits every id', async () => {
    const events = await decode([
      {
        type: 'response.output_item.added',
        output_index: 0,
        item: { type: 'function_call', name: 'lookup' },
      },
    ]);

    expect(events).toContainEqual({
      type: 'block-open',
      index: 0,
      opening: { kind: 'tool', id: 'toolu_stream_0', name: 'lookup' },
    });
  });
});

describe('decodeStream: the whole tool-call stream maps event for event', () => {
  it('folds the created, added, delta, done, and completed events into hub events', async () => {
    const events = await decode(aResponsesToolCallStream());

    expect(events).toEqual([
      { type: 'message-begin' },
      {
        type: 'block-open',
        index: 0,
        opening: { kind: 'tool', id: 'call_weather', name: 'get_weather' },
      },
      {
        type: 'block-delta',
        index: 0,
        delta: { kind: 'json-args', partialJson: '{"city":"Paris"}' },
      },
      { type: 'block-close', index: 0 },
      { type: 'message-end', stopReason: 'tool_use', usage: { inputTokens: 20, outputTokens: 5 } },
    ]);
  });
});

describe('decodeStream: a failure and the unknown pass through honestly', () => {
  it('carries a mid-stream error as a terminal stream-error with no synthetic success after', async () => {
    const events = await decode([
      { type: 'response.created', response: { id: 'r', status: 'in_progress', output: [] } },
      { type: 'error', code: 'overloaded_error', message: 'slow down' },
    ]);

    expect(events.at(-1)).toEqual({
      type: 'stream-error',
      error: { type: 'overloaded_error', message: 'slow down' },
    });
    expect(events.some((event) => event.type === 'message-end')).toBe(false);
  });

  it('yields a stream-error when the completed answer names an unmappable stop', async () => {
    const events = await decode([
      {
        type: 'response.completed',
        response: {
          id: 'r',
          status: 'incomplete',
          output: [],
          incomplete_details: { reason: 'server_pause' },
        },
      },
    ]);

    expect(events.at(-1)).toEqual({
      type: 'stream-error',
      error: { type: 'unmappable_stop_reason', message: 'server_pause' },
    });
  });

  it('passes an unrecognized event through without ending the stream', async () => {
    const events = await decode([
      { type: 'response.created', response: { id: 'r', status: 'in_progress', output: [] } },
      { type: 'response.in_progress' },
      { type: 'response.completed', response: { id: 'r', status: 'completed', output: [] } },
    ]);

    expect(events.map((event) => event.type)).toEqual(['message-begin', 'message-end']);
  });
});
