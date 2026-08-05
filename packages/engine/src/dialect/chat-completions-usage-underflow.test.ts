import { describe, expect, it } from 'vitest';

import { decodeResponse } from './chat-completions-codec';
import { aChatResponse } from './chat-completions.testkit';

describe('the codec never reports negative input tokens', () => {
  it('clamps input tokens to zero when cached tokens exceed the prompt total', () => {
    const response = aChatResponse({
      usage: {
        prompt_tokens: 3,
        completion_tokens: 8,
        prompt_tokens_details: { cached_tokens: 5 },
      },
    });

    expect(decodeResponse(response).value.usage.inputTokens).toBe(0);
  });
});
