import { describe, expect, it } from 'vitest';

import { decodeResponse as decodeGemini } from './gemini-response';
import { decodeResponse, encodeResponse } from './interactions-codec';

describe('Gemini responses crossing through Interactions', () => {
  it('should preserve text, function calls, signatures, and usage', () => {
    const decoded = decodeGemini({
      candidates: [
        {
          content: {
            role: 'model',
            parts: [
              { text: 'ok' },
              {
                functionCall: { id: 'call_1', name: 'lookup', args: { q: 'x' } },
                thoughtSignature: 'sig_1',
              },
            ],
          },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 3, cachedContentTokenCount: 4 },
    });
    const encoded = encodeResponse(decoded.value).value;

    expect(encoded.steps).toEqual([
      { type: 'model_output', content: [{ type: 'text', text: 'ok' }] },
      {
        type: 'function_call',
        id: 'call_1',
        call_id: 'call_1',
        name: 'lookup',
        arguments: { q: 'x' },
        signature: 'sig_1',
      },
    ]);
    expect(encoded.usage).toEqual({
      total_input_tokens: 2,
      total_output_tokens: 3,
      cached_tokens: 4,
    });
  });
});

describe('Gemini media responses crossing through Interactions', () => {
  it('should preserve inline image output as an Interactions model step', () => {
    const decoded = decodeGemini({
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ inlineData: { mimeType: 'image/png', data: 'aGVsbG8=' } }],
          },
          finishReason: 'STOP',
        },
      ],
    });

    expect(encodeResponse(decoded.value).value.steps).toEqual([
      {
        type: 'model_output',
        content: [{ type: 'image', mime_type: 'image/png', data: 'aGVsbG8=' }],
      },
    ]);
  });
});

describe('Interactions responses crossing into the hub', () => {
  it('should restore thought and function-call output with usage', () => {
    const decoded = decodeResponse({
      id: 'interaction_1',
      status: 'requires_action',
      steps: [
        { type: 'thought', content: [{ type: 'text', text: 'consider' }], signature: 'sig_1' },
        { type: 'model_output', content: [{ type: 'text', text: 'ok' }] },
        { type: 'function_call', call_id: 'call_1', name: 'lookup', arguments: '{"q":"x"}' },
      ],
      usage: { total_input_tokens: 3, total_output_tokens: 4, reasoning_tokens: 2 },
    });

    expect(decoded.value).toEqual({
      content: [
        { type: 'thinking', text: 'consider', signature: 'sig_1' },
        { type: 'text', text: 'ok' },
        { type: 'tool_use', id: 'call_1', name: 'lookup', input: { q: 'x' } },
      ],
      stopReason: 'tool_use',
      usage: { inputTokens: 3, outputTokens: 4, reasoningTokens: 2 },
    });
  });
});
