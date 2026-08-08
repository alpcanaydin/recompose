import { describe, expect, it } from 'vitest';

import type { AnthropicStreamEvent } from './anthropic-wire';
import type { GeminiResponse } from './gemini-wire';

import { translateStreamFromGemini } from './gemini-bridge';

describe('Gemini signature-only stream parts crossing Claude', () => {
  it('should attach the signature to thinking without opening an empty text block', async () => {
    const events: AnthropicStreamEvent[] = [];

    for await (const event of translateStreamFromGemini('anthropic', streamOf(chunks()))) {
      events.push(event);
    }

    expect(
      events.some(
        (event) =>
          event.type === 'content_block_start' &&
          'content_block' in event &&
          event.content_block.type === 'text',
      ),
    ).toBe(false);
    expect(events).toContainEqual({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'signature_delta', signature: 'sig-test' },
    });
    expect(events.filter(isFirstBlockStop)).toHaveLength(1);
    expect(events).toContainEqual(expect.objectContaining({ type: 'message_delta' }));
    expect(events.at(-1)).toEqual({ type: 'message_stop' });
  });
});

function chunks(): readonly GeminiResponse[] {
  return [
    {
      candidates: [{ content: { parts: [{ text: 'thinking text', thought: true }] } }],
      modelVersion: 'gemini-test',
      responseId: 'resp-test',
    },
    {
      candidates: [
        {
          content: { parts: [{ text: '', thoughtSignature: 'sig-test' }] },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: { promptTokenCount: 10, thoughtsTokenCount: 2, totalTokenCount: 12 },
      modelVersion: 'gemini-test',
      responseId: 'resp-test',
    },
  ];
}

function isFirstBlockStop(
  event: AnthropicStreamEvent,
): event is Extract<AnthropicStreamEvent, { type: 'content_block_stop' }> {
  return event.type === 'content_block_stop' && 'index' in event && event.index === 0;
}

async function* streamOf<T>(values: readonly T[]): AsyncIterable<T> {
  for (const value of values) {
    await Promise.resolve();
    yield value;
  }
}
