import { describe, expect, it } from 'vitest';

import type { AnthropicStreamEvent } from './anthropic-wire';

import { decodeStream } from './anthropic-stream';
import { anAnthropicWireTextStream } from './anthropic.testkit';
import { collect, streamOf } from './chat-completions.testkit';

describe('decodeStream reads the named wire events into hub events', () => {
  it('reads a text stream in order, tolerating ping events', async () => {
    const events = await collect(decodeStream(streamOf(anAnthropicWireTextStream())));

    expect(events).toEqual([
      { type: 'message-begin', usage: { inputTokens: 12, outputTokens: 8 } },
      { type: 'block-open', index: 0, opening: { kind: 'text' } },
      { type: 'block-delta', index: 0, delta: { kind: 'text', text: 'Hel' } },
      { type: 'block-delta', index: 0, delta: { kind: 'text', text: 'lo' } },
      { type: 'block-close', index: 0 },
      {
        type: 'message-end',
        stopReason: 'end',
        usage: { inputTokens: 12, outputTokens: 15 },
      },
    ]);
  });

  it('reads a tool_use block start with its id, name, and json deltas', async () => {
    const wire: readonly AnthropicStreamEvent[] = [
      {
        type: 'content_block_start',
        index: 1,
        content_block: { type: 'tool_use', id: 'toolu_01', name: 'get_weather', input: {} },
      },
      {
        type: 'content_block_delta',
        index: 1,
        delta: { type: 'input_json_delta', partial_json: '{"city":' },
      },
      { type: 'content_block_stop', index: 1 },
    ];

    const events = await collect(decodeStream(streamOf(wire)));

    expect(events).toEqual([
      {
        type: 'block-open',
        index: 1,
        opening: { kind: 'tool', id: 'toolu_01', name: 'get_weather' },
      },
      { type: 'block-delta', index: 1, delta: { kind: 'json-args', partialJson: '{"city":' } },
      { type: 'block-close', index: 1 },
    ]);
  });
});

describe('decodeStream reads the thinking lane and the gaps', () => {
  it('reads thinking and signature deltas over a thinking block', async () => {
    const wire: readonly AnthropicStreamEvent[] = [
      {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'thinking', thinking: '' },
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'thinking_delta', thinking: 'weigh the routes' },
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'signature_delta', signature: 'sig-40d1' },
      },
    ];

    const events = await collect(decodeStream(streamOf(wire)));

    expect(events).toEqual([
      { type: 'block-open', index: 0, opening: { kind: 'thinking' } },
      { type: 'block-delta', index: 0, delta: { kind: 'thinking', text: 'weigh the routes' } },
      { type: 'block-delta', index: 0, delta: { kind: 'signature', signature: 'sig-40d1' } },
    ]);
  });

  it('skips a block the hub cannot open, deltas and stop included', async () => {
    const wire: readonly AnthropicStreamEvent[] = [
      {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'redacted_thinking', data: 'opaque' },
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'signature_delta', signature: 'sig-40d1' },
      },
      { type: 'content_block_stop', index: 0 },
      { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
    ];

    const events = await collect(decodeStream(streamOf(wire)));

    expect(events).toEqual([{ type: 'block-open', index: 1, opening: { kind: 'text' } }]);
  });
});

describe('decodeStream tolerates the unknown and ends on an error', () => {
  it('ignores an event type it has never met, per the versioning policy', async () => {
    const wire: readonly AnthropicStreamEvent[] = [
      { type: 'a_future_event' },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    ];

    const events = await collect(decodeStream(streamOf(wire)));

    expect(events).toEqual([{ type: 'block-open', index: 0, opening: { kind: 'text' } }]);
  });

  it('reads a wire error as a terminal stream error', async () => {
    const wire: readonly AnthropicStreamEvent[] = [
      { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    ];

    const events = await collect(decodeStream(streamOf(wire)));

    expect(events).toEqual([
      { type: 'stream-error', error: { type: 'overloaded_error', message: 'Overloaded' } },
    ]);
  });

  it('reads a bare message_stop as a plain end', async () => {
    const events = await collect(decodeStream(streamOf([{ type: 'message_stop' }])));

    expect(events).toEqual([{ type: 'message-end', stopReason: 'end', usage: {} }]);
  });

  it('reads nothing past message_stop, even when events trail behind', async () => {
    const wire: readonly AnthropicStreamEvent[] = [
      { type: 'message_stop' },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    ];

    const events = await collect(decodeStream(streamOf(wire)));

    expect(events).toEqual([{ type: 'message-end', stopReason: 'end', usage: {} }]);
  });

  it('reads a message_start naming no usage as an empty beginning', async () => {
    const wire: readonly AnthropicStreamEvent[] = [
      {
        type: 'message_start',
        message: {
          id: 'msg_01',
          type: 'message',
          role: 'assistant',
          content: [],
          stop_reason: null,
        },
      },
    ];

    const events = await collect(decodeStream(streamOf(wire)));

    expect(events).toEqual([{ type: 'message-begin', usage: {} }]);
  });
});
