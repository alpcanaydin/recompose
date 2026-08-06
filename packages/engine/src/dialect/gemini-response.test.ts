import { describe, expect, test } from 'vitest';

import { decodeResponse } from './gemini-response';

describe('Gemini response decoding', () => {
  test('maps text, signed thoughts, function calls, finish reason, and usage', () => {
    const translated = decodeResponse({
      candidates: [
        {
          content: {
            role: 'model',
            parts: [
              { text: 'reason', thought: true, thoughtSignature: 'sig' },
              { text: 'hello' },
              { functionCall: { name: 'weather', args: { city: 'Istanbul' }, id: 'call_1' } },
            ],
          },
          finishReason: 'MAX_TOKENS',
        },
      ],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 4,
        cachedContentTokenCount: 3,
        thoughtsTokenCount: 2,
      },
    });

    expect(translated.value).toEqual({
      content: [
        { type: 'thinking', text: 'reason', signature: 'sig' },
        { type: 'text', text: 'hello' },
        { type: 'tool_use', id: 'call_1', name: 'weather', input: { city: 'Istanbul' } },
      ],
      stopReason: 'max_output',
      usage: { inputTokens: 10, outputTokens: 4, cacheReadTokens: 3, reasoningTokens: 2 },
    });
  });
});
