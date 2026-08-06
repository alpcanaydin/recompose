import { describe, expect, test } from 'vitest';

import type { GeminiResponse } from './gemini-wire';

import { decodeStream } from './gemini-stream';

async function* source(): AsyncIterable<GeminiResponse> {
  await Promise.resolve();
  yield {
    candidates: [{ content: { role: 'model', parts: [{ text: 'hel' }] } }],
    usageMetadata: { promptTokenCount: 3 },
  };
  yield {
    candidates: [
      {
        content: { role: 'model', parts: [{ text: 'lo' }] },
        finishReason: 'MAX_TOKENS',
      },
    ],
    usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 },
  };
}

describe('Gemini stream decoding', () => {
  test('emits ordered hub blocks and terminal usage', async () => {
    const events = [];

    for await (const event of decodeStream(source())) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'message-begin', usage: { inputTokens: 3 } },
      { type: 'block-open', index: 0, opening: { kind: 'text' } },
      { type: 'block-delta', index: 0, delta: { kind: 'text', text: 'hel' } },
      { type: 'block-close', index: 0 },
      { type: 'block-open', index: 1, opening: { kind: 'text' } },
      { type: 'block-delta', index: 1, delta: { kind: 'text', text: 'lo' } },
      { type: 'block-close', index: 1 },
      {
        type: 'message-end',
        stopReason: 'max_output',
        usage: { inputTokens: 3, outputTokens: 2 },
      },
    ]);
  });
});
