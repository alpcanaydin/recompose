import { describe, expect, it } from 'vitest';

import type { ResponsesRequest } from './responses-wire';

import { translateRequestToGemini } from './gemini-bridge';

describe('Responses assistant prefill crossing Gemini', () => {
  it('should strip a trailing assistant message', () => {
    const translated = translateRequestToGemini('responses', {
      model: 'gpt-5.4',
      input: [message('user', 'hello'), message('assistant', 'previous answer')],
    });

    expect(translated).toHaveProperty('value.contents', [
      { role: 'user', parts: [{ text: 'hello' }] },
    ]);
  });

  it('should preserve reasoning before a trailing assistant message', () => {
    const translated = translateRequestToGemini('responses', {
      model: 'gpt-5.4',
      input: [
        message('user', 'hello'),
        {
          type: 'reasoning',
          summary: [{ type: 'summary_text', text: 'reasoning summary' }],
        },
        message('assistant', 'previous answer'),
      ],
    });

    expect(translated).toHaveProperty('value.contents', [
      { role: 'user', parts: [{ text: 'hello' }] },
      { role: 'model', parts: [{ text: 'reasoning summary', thought: true }] },
    ]);
  });

  it('should preserve an assistant message that is not trailing', () => {
    const translated = translateRequestToGemini('responses', {
      model: 'gpt-5.4',
      input: [
        message('user', 'first'),
        message('assistant', 'answer'),
        message('user', 'follow up'),
      ],
    });

    expect(translated).toHaveProperty('value.contents', [
      { role: 'user', parts: [{ text: 'first' }] },
      { role: 'model', parts: [{ text: 'answer' }] },
      { role: 'user', parts: [{ text: 'follow up' }] },
    ]);
  });
});

function message(role: 'user' | 'assistant', text: string): ResponsesRequest['input'][number] {
  return {
    type: 'message',
    role,
    content: [{ type: role === 'user' ? 'input_text' : 'output_text', text }],
  };
}
