import { describe, expect, it } from 'vitest';

import { translateResponse } from './dispatcher';

describe('Responses answers crossing Interactions', () => {
  it('should preserve function calls, detailed usage, and response identity', () => {
    const translated = translateResponse('responses', 'interactions', {
      id: 'resp_1',
      status: 'completed',
      output: [
        { type: 'function_call', call_id: 'call_1', name: 'lookup', arguments: '{"q":"x"}' },
      ],
      usage: {
        input_tokens: 11,
        output_tokens: 13,
        input_tokens_details: { cached_tokens: 5 },
        output_tokens_details: { reasoning_tokens: 7 },
      },
    });

    if ('outcome' in translated || 'refusal' in translated) {
      throw new Error('expected translated response');
    }

    expect(translated.value.id).toBe('resp_1');
    expect(translated.value.steps).toContainEqual({
      type: 'function_call',
      id: 'call_1',
      call_id: 'call_1',
      name: 'lookup',
      arguments: { q: 'x' },
    });
    expect(translated.value.usage).toMatchObject({
      input_tokens: 11,
      total_input_tokens: 11,
      total_output_tokens: 13,
      cached_tokens: 5,
      reasoning_tokens: 7,
      total_tokens: 24,
    });
  });
});

describe('Interactions answers crossing Responses', () => {
  it('should preserve text and synthesize total usage', () => {
    const translated = translateResponse('interactions', 'responses', {
      id: 'interaction_1',
      status: 'completed',
      steps: [{ type: 'model_output', content: [{ type: 'text', text: 'ok' }] }],
      usage: { input_tokens: 1, output_tokens: 2 },
    });

    if ('outcome' in translated || 'refusal' in translated) {
      throw new Error('expected translated response');
    }

    expect(translated.value.output).toContainEqual({
      type: 'message',
      role: 'assistant',
      content: [{ type: 'output_text', text: 'ok' }],
    });
    expect(translated.value.usage).toMatchObject({
      input_tokens: 1,
      output_tokens: 2,
      total_tokens: 3,
    });
  });
});
