import { describe, expect, it } from 'vitest';

import { thinkingBlockOf, toHubUsage } from './responses-shared';

describe('toHubUsage: a partial vendor usage block crosses to the hub', () => {
  it('leaves the input tokens absent when the vendor counted none', () => {
    expect(toHubUsage({ output_tokens: 8 })).toEqual({ outputTokens: 8 });
  });

  it('leaves the output tokens absent when the vendor counted none', () => {
    expect(toHubUsage({ input_tokens: 12 })).toEqual({ inputTokens: 12 });
  });
});

describe('thinkingBlockOf: a reasoning item the vendor never summarized', () => {
  it('falls back to the reasoning text and trims its trailing blank lines', () => {
    const block = thinkingBlockOf({
      type: 'reasoning',
      id: 'rs_1',
      content: [{ type: 'reasoning_text', text: 'weigh the two routes\n\n' }],
    });

    expect(block).toEqual({ type: 'thinking', text: 'weigh the two routes' });
  });
});
