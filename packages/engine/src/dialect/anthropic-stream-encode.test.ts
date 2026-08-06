import { describe, expect, it } from 'vitest';

import type { HubStreamEvent } from './hub';

import { encodeStream } from './anthropic-stream';
import { collect, streamOf } from './chat-completions.testkit';

const emptyEnvelope = {
  id: 'msg_translated',
  type: 'message',
  role: 'assistant',
  content: [],
  stop_reason: null,
  stop_sequence: null,
  usage: { input_tokens: 0, output_tokens: 0 },
};

describe('encodeStream writes the hub events as named wire stream events', () => {
  it('writes a text answer as message_start, block events, message_delta, and message_stop', async () => {
    const hub: readonly HubStreamEvent[] = [
      { type: 'message-begin' },
      { type: 'block-open', index: 0, opening: { kind: 'text' } },
      { type: 'block-delta', index: 0, delta: { kind: 'text', text: 'Hel' } },
      { type: 'block-delta', index: 0, delta: { kind: 'text', text: 'lo' } },
      { type: 'block-close', index: 0 },
      { type: 'message-end', stopReason: 'end', usage: { inputTokens: 12, outputTokens: 8 } },
    ];

    const events = await collect(encodeStream(streamOf(hub)));

    expect(events).toEqual([
      { type: 'message_start', message: emptyEnvelope },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hel' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'lo' } },
      { type: 'content_block_stop', index: 0 },
      {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { input_tokens: 12, output_tokens: 8 },
      },
      { type: 'message_stop' },
    ]);
  });
});

describe('encodeStream writes the tool and thinking blocks', () => {
  it('opens a tool block with its id and name and streams input_json_delta', async () => {
    const hub: readonly HubStreamEvent[] = [
      { type: 'message-begin' },
      {
        type: 'block-open',
        index: 0,
        opening: { kind: 'tool', id: 'toolu_01', name: 'get_weather' },
      },
      { type: 'block-delta', index: 0, delta: { kind: 'json-args', partialJson: '{"city":' } },
      { type: 'block-close', index: 0 },
      { type: 'message-end', stopReason: 'tool_use', usage: {} },
    ];

    const events = await collect(encodeStream(streamOf(hub)));

    expect(events).toContainEqual({
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'tool_use', id: 'toolu_01', name: 'get_weather', input: {} },
    });
    expect(events).toContainEqual({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'input_json_delta', partial_json: '{"city":' },
    });
    expect(events).toContainEqual({
      type: 'message_delta',
      delta: { stop_reason: 'tool_use', stop_sequence: null },
      usage: { input_tokens: 0, output_tokens: 0 },
    });
  });
});

describe('encodeStream writes the thinking lane', () => {
  it('streams thinking and signature deltas over an open thinking block', async () => {
    const hub: readonly HubStreamEvent[] = [
      { type: 'message-begin' },
      { type: 'block-open', index: 0, opening: { kind: 'thinking' } },
      { type: 'block-delta', index: 0, delta: { kind: 'thinking', text: 'weigh the routes' } },
      { type: 'block-delta', index: 0, delta: { kind: 'signature', signature: 'sig-40d1' } },
      { type: 'block-close', index: 0 },
      { type: 'message-end', stopReason: 'end', usage: {} },
    ];

    const events = await collect(encodeStream(streamOf(hub)));

    expect(events).toContainEqual({
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'thinking', thinking: '' },
    });
    expect(events).toContainEqual({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'thinking_delta', thinking: 'weigh the routes' },
    });
    expect(events).toContainEqual({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'signature_delta', signature: 'sig-40d1' },
    });
  });
});

describe('encodeStream carries the usage and the stream ends', () => {
  it('carries the begin usage into message_start and merges it into message_delta', async () => {
    const hub: readonly HubStreamEvent[] = [
      { type: 'message-begin', usage: { inputTokens: 25 } },
      { type: 'message-end', stopReason: 'end', usage: { outputTokens: 15 } },
    ];

    const events = await collect(encodeStream(streamOf(hub)));

    expect(events.at(0)).toEqual({
      type: 'message_start',
      message: { ...emptyEnvelope, usage: { input_tokens: 25, output_tokens: 0 } },
    });
    expect(events.at(1)).toEqual({
      type: 'message_delta',
      delta: { stop_reason: 'end_turn', stop_sequence: null },
      usage: { input_tokens: 25, output_tokens: 15 },
    });
  });

  it('writes a stream error as a terminal wire error event', async () => {
    const hub: readonly HubStreamEvent[] = [
      { type: 'message-begin' },
      { type: 'stream-error', error: { type: 'overloaded_error', message: 'Overloaded' } },
      { type: 'block-open', index: 0, opening: { kind: 'text' } },
    ];

    const events = await collect(encodeStream(streamOf(hub)));

    expect(events.at(-1)).toEqual({
      type: 'error',
      error: { type: 'overloaded_error', message: 'Overloaded' },
    });
    expect(events).toHaveLength(2);
  });

  it('ends the stream at message_stop even when events trail behind', async () => {
    const hub: readonly HubStreamEvent[] = [
      { type: 'message-begin' },
      { type: 'message-end', stopReason: 'end', usage: {} },
      { type: 'block-open', index: 0, opening: { kind: 'text' } },
    ];

    const events = await collect(encodeStream(streamOf(hub)));

    expect(events.at(-1)).toEqual({ type: 'message_stop' });
  });
});
