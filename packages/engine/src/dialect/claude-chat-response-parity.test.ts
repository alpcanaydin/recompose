import { describe, expect, it } from 'vitest';

import type { AnthropicStreamEvent } from './anthropic-wire';

import { decodeStream as decodeAnthropicStream } from './anthropic-stream';
import { encodeResponse as encodeChatResponse } from './chat-completions-response';
import { encodeStream as encodeChatStream } from './chat-completions-stream';
import { collectHubResponse } from './hub-stream-response';

describe('Claude stream usage crossing Chat', () => {
  it('should merge opening usage and report both cache counters', async () => {
    const frames = [];

    for await (const frame of encodeChatStream(
      decodeAnthropicStream(streamOf(claudeUsageStream())),
    )) {
      frames.push(frame);
    }

    const usage = frames
      .flatMap((frame) => (frame.type === 'chunk' && frame.chunk.usage ? [frame.chunk.usage] : []))
      .at(0);

    expect(usage).toEqual({
      prompt_tokens: 22044,
      completion_tokens: 4,
      total_tokens: 22048,
      prompt_tokens_details: { cached_tokens: 22000, cached_creation_tokens: 31 },
    });
  });
});

describe('Claude SSE collected as a non-stream Chat answer', () => {
  it('should preserve usage and map finish reasons', async () => {
    const hub = await collectHubResponse(decodeAnthropicStream(streamOf(claudeUsageStream())));

    if (hub === null) throw new Error('expected collected response');

    const translated = encodeChatResponse(hub);

    if ('refusal' in translated) throw new Error('expected Chat response');

    expect(translated.value.choices[0]?.finish_reason).toBe('stop');
    expect(translated.value.usage).toEqual({
      prompt_tokens: 22044,
      completion_tokens: 4,
      total_tokens: 22048,
      prompt_tokens_details: { cached_tokens: 22000, cached_creation_tokens: 31 },
    });
  });
});

function claudeUsageStream(): readonly AnthropicStreamEvent[] {
  return [
    {
      type: 'message_start',
      message: {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: 13,
          output_tokens: 1,
          cache_read_input_tokens: 22000,
          cache_creation_input_tokens: 31,
        },
      },
    },
    {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn', stop_sequence: null },
      usage: { output_tokens: 4 },
    },
    { type: 'message_stop' },
  ];
}

async function* streamOf<T>(values: readonly T[]): AsyncIterable<T> {
  for (const value of values) {
    await Promise.resolve();
    yield value;
  }
}
