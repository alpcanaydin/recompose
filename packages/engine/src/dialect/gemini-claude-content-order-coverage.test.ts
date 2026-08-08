import { describe, expect, it } from 'vitest';

import type { AnthropicRequest } from './anthropic-wire';
import type { GeminiPart } from './gemini-wire';

import { translateRequestToGemini } from './gemini-bridge';

function modelParts(request: AnthropicRequest): readonly GeminiPart[] {
  const translated = translateRequestToGemini('anthropic', request);

  if ('refusal' in translated) throw new Error('the Anthropic request was refused');

  return translated.value.contents.find((content) => content.role === 'model')?.parts ?? [];
}

describe('a Claude turn that redacted the thinking behind its answer', () => {
  it('puts the redacted thinking ahead of the answer it explains', () => {
    const parts = modelParts({
      model: 'claude-sonnet',
      max_tokens: 256,
      messages: [
        { role: 'user', content: 'why?' },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'because' },
            { type: 'redacted_thinking', data: 'sealed' },
          ],
        },
      ],
    });

    expect(parts[0]).toMatchObject({ text: '', thought: true, thoughtSignature: 'sealed' });
    expect(parts[1]).toMatchObject({ text: 'because' });
  });
});
