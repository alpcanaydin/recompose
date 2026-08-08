import { describe, expect, it } from 'vitest';

import { translateResponseFromGemini } from './gemini-bridge';

describe('snake-case Gemini answers crossing Interactions', () => {
  it('should preserve identity, function calls, and every usage counter', () => {
    const translated = translateResponseFromGemini('interactions', {
      response_id: 'resp_snake',
      model_version: 'gemini-3.5-flash',
      candidates: [
        {
          content: {
            role: 'model',
            parts: [
              {
                functionCall: { name: 'lookup', call_id: 'call_1', args: { q: 'x' } },
              },
            ],
          },
          finish_reason: 'STOP',
        },
      ],
      usage_metadata: {
        prompt_token_count: 11,
        candidates_token_count: 22,
        total_token_count: 33,
        thoughts_token_count: 44,
        cached_content_token_count: 55,
      },
    });

    if ('refusal' in translated) throw new Error('expected translated response');

    expect(translated.value).toMatchObject({
      id: 'resp_snake',
      model: 'gemini-3.5-flash',
      status: 'completed',
      steps: [
        {
          type: 'function_call',
          id: 'call_1',
          call_id: 'call_1',
          name: 'lookup',
          arguments: { q: 'x' },
        },
      ],
      usage: {
        input_tokens: 11,
        output_tokens: 22,
        reasoning_tokens: 44,
        cached_tokens: 55,
        total_tokens: 33,
      },
    });
  });
});
