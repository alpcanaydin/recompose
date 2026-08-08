import { describe, expect, test } from 'vitest';

import type { AnthropicStreamEvent } from './anthropic-wire';

import { decodeStream } from './anthropic-stream';
import { collect, streamOf } from './chat-completions.testkit';

const citation = { type: 'web_search_result_location', url: 'https://example.test/a' };

const textBlockOpen: AnthropicStreamEvent = {
  type: 'content_block_start',
  index: 0,
  content_block: { type: 'text', text: '' },
};

const citationDelta: AnthropicStreamEvent = {
  type: 'content_block_delta',
  index: 0,
  delta: { type: 'citations_delta', citation },
};

const messageStop: AnthropicStreamEvent = { type: 'message_stop' };

function offContractEvent(type: string, fields: Record<string, unknown>): AnthropicStreamEvent {
  return { ...fields, type };
}

describe('a citation that arrives before any text block', () => {
  test('a citation with no text block to attach to is dropped', async () => {
    const events = await collect(decodeStream(streamOf([citationDelta, messageStop])));

    expect(events).toEqual([{ type: 'message-end', stopReason: 'end', usage: {} }]);
  });

  test('a citation that follows a text block attaches to it', async () => {
    const events = await collect(
      decodeStream(streamOf([textBlockOpen, citationDelta, messageStop])),
    );

    expect(events).toContainEqual({
      type: 'block-delta',
      index: 0,
      delta: { kind: 'annotation', annotation: citation },
    });
  });
});

describe('a delta the wire contract does not name', () => {
  test('an unrecognized delta is refused rather than silently dropped', async () => {
    const unknownDelta = offContractEvent('content_block_delta', {
      index: 0,
      delta: { type: 'sentiment_delta' },
    });

    await expect(collect(decodeStream(streamOf([textBlockOpen, unknownDelta])))).rejects.toThrow(
      'decodeStream met an unknown delta',
    );
  });

  test('an event type the wire contract does not name is skipped', async () => {
    const events = await collect(decodeStream(streamOf([{ type: 'heartbeat' }, messageStop])));

    expect(events).toEqual([{ type: 'message-end', stopReason: 'end', usage: {} }]);
  });
});
