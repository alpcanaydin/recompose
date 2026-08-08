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
      usage: {
        inputTokens: 7,
        totalInputTokens: 10,
        outputTokens: 4,
        cacheReadTokens: 3,
        reasoningTokens: 2,
      },
    });
  });
});

describe('Gemini response decoding of parts the hub cannot place', () => {
  test('ends the turn on a finish reason the hub does not know', () => {
    const translated = decodeResponse({
      candidates: [{ content: { role: 'model', parts: [{ text: 'hello' }] }, finishReason: 'NEW' }],
    });

    expect(translated.value.stopReason).toBe('end');
  });

  test('gives a function call with no arguments an empty input', () => {
    const translated = decodeResponse({
      candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'ping' } }] } }],
    });

    expect(translated.value.content).toEqual([
      { type: 'tool_use', id: 'call_0', name: 'ping', input: {} },
    ]);
  });

  test('records a part carrying neither text nor a structured block as absent', () => {
    const translated = decodeResponse({
      candidates: [{ content: { role: 'model', parts: [{}, { text: 'hello' }] } }],
    });

    expect(translated.value.content).toEqual([{ type: 'text', text: 'hello' }]);
    expect(translated.fates).toContainEqual({
      field: 'candidates.0.content.parts.0',
      disposition: 'mapped',
      to: 'absent',
    });
  });
});
