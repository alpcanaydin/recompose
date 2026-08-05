import { describe, expect, it } from 'vitest';

import type { HubStreamEvent } from './hub';

import { aHubStreamOfAToolCall } from './hub.testkit';
import { encodeStream } from './responses-codec';
import { collect, streamOf } from './responses.testkit';

async function encode(events: readonly HubStreamEvent[]) {
  return collect(encodeStream(streamOf(events)));
}

describe('encodeStream: hub events fold back out to Responses events', () => {
  it('adds a function_call output item carrying the tool name and id', async () => {
    const events = await encode(aHubStreamOfAToolCall());

    expect(events).toContainEqual({
      type: 'response.output_item.added',
      output_index: 0,
      item: {
        type: 'function_call',
        id: 'toolu_weather',
        call_id: 'toolu_weather',
        name: 'get_weather',
      },
    });
  });

  it('streams the tool arguments through a function-call arguments delta', async () => {
    const events = await encode(aHubStreamOfAToolCall());

    expect(events).toContainEqual({
      type: 'response.function_call_arguments.delta',
      output_index: 0,
      delta: '{"city":"Paris"}',
    });
  });
});

describe('encodeStream: the whole tool-call stream folds event for event', () => {
  it('folds the hub tool-call stream into the Responses event sequence', async () => {
    const events = await encode(aHubStreamOfAToolCall());

    expect(events).toEqual([
      {
        type: 'response.created',
        response: { id: 'resp_translated', status: 'in_progress', output: [] },
      },
      {
        type: 'response.output_item.added',
        output_index: 0,
        item: {
          type: 'function_call',
          id: 'toolu_weather',
          call_id: 'toolu_weather',
          name: 'get_weather',
        },
      },
      {
        type: 'response.function_call_arguments.delta',
        output_index: 0,
        delta: '{"city":"Paris"}',
      },
      { type: 'response.output_item.done', output_index: 0 },
      {
        type: 'response.completed',
        response: {
          id: 'resp_translated',
          status: 'completed',
          output: [],
          usage: { input_tokens: 12, output_tokens: 8 },
        },
      },
    ]);
  });
});

describe('encodeStream: openings and terminators cross to Responses', () => {
  it('adds a message output item for a text block open', async () => {
    const events = await encode([{ type: 'block-open', index: 0, opening: { kind: 'text' } }]);

    expect(events).toEqual([
      {
        type: 'response.output_item.added',
        output_index: 0,
        item: { type: 'message', role: 'assistant' },
      },
    ]);
  });

  it('ends a truncated answer on an incomplete completed event', async () => {
    const events = await encode([
      { type: 'message-end', stopReason: 'max_output', usage: { outputTokens: 9 } },
    ]);

    expect(events).toEqual([
      {
        type: 'response.completed',
        response: {
          id: 'resp_translated',
          status: 'incomplete',
          output: [],
          incomplete_details: { reason: 'max_output_tokens' },
          usage: { output_tokens: 9 },
        },
      },
    ]);
  });

  it('adds a reasoning item for a thinking block open and skips its deltas', async () => {
    const events = await encode([
      { type: 'block-open', index: 0, opening: { kind: 'thinking' } },
      { type: 'block-delta', index: 0, delta: { kind: 'thinking', text: 'ponder' } },
      { type: 'block-delta', index: 0, delta: { kind: 'signature', signature: 'sig' } },
      { type: 'block-close', index: 0 },
    ]);

    expect(events).toContainEqual({
      type: 'response.output_item.added',
      output_index: 0,
      item: { type: 'reasoning', id: 'rs_stream_0' },
    });
    expect(events.some((event) => event.type === 'response.output_text.delta')).toBe(false);
  });
});

describe('encodeStream: a failure crosses as an error event', () => {
  it('maps a hub stream error to a Responses error event', async () => {
    const events = await encode([
      { type: 'stream-error', error: { type: 'overloaded_error', message: 'slow down' } },
    ]);

    expect(events).toEqual([{ type: 'error', code: 'overloaded_error', message: 'slow down' }]);
  });

  it('maps a message-end with an unmappable stop reason to an error event', async () => {
    const events = await encode([
      { type: 'message-end', stopReason: 'paused', usage: { inputTokens: 3 } },
    ]);

    expect(events).toEqual([{ type: 'error', code: 'unmappable_stop_reason', message: 'paused' }]);
  });
});
