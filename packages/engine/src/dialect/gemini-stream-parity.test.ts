import { describe, expect, it } from 'vitest';

import type { GeminiResponse } from './gemini-wire';

import { decodeStream } from './gemini-stream';

describe('Gemini stream terminal parity', () => {
  it('should emit a terminal once when later chunks repeat finish metadata', async () => {
    const events = await decoded([
      {
        candidates: [{ content: { role: 'model', parts: [{ text: 'ok' }] }, finishReason: 'STOP' }],
      },
      {
        candidates: [],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 2, totalTokenCount: 3 },
      },
    ]);

    expect(events.filter((event) => event.type === 'message-end')).toHaveLength(1);
  });

  it('should complete on source done when no finish usage arrives', async () => {
    const events = await decoded([
      { candidates: [{ content: { role: 'model', parts: [{ text: 'ok' }] } }] },
    ]);

    expect(events.at(-1)).toEqual({ type: 'message-end', stopReason: 'end', usage: {} });
  });

  it('should retain snake-case usage until a source-done terminal', async () => {
    const events = await decoded([
      {
        candidates: [],
        usage_metadata: {
          prompt_token_count: 2,
          candidates_token_count: 3,
          cached_content_token_count: 1,
          thoughts_token_count: 4,
        },
      },
    ]);

    expect(events.at(-1)).toEqual({
      type: 'message-end',
      stopReason: 'end',
      usage: {
        inputTokens: 1,
        totalInputTokens: 2,
        outputTokens: 3,
        cacheReadTokens: 1,
        reasoningTokens: 4,
      },
    });
  });
});

async function decoded(source: readonly GeminiResponse[]) {
  const events = [];

  for await (const event of decodeStream(streamOf(source))) events.push(event);

  return events;
}

async function* streamOf<T>(values: readonly T[]): AsyncIterable<T> {
  for (const value of values) {
    await Promise.resolve();
    yield value;
  }
}
