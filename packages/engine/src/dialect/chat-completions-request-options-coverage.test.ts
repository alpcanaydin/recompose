import { describe, expect, it } from 'vitest';

import type { Fate } from './fates';

import { hubOptionsFromChat } from './chat-completions-request-options';

describe('reading Gemini generation config off a chat request', () => {
  it('should accept the snake_case spelling of includeThoughts', () => {
    const fates: Fate[] = [];

    const options = hubOptionsFromChat(
      { messages: [], generationConfig: { thinkingConfig: { include_thoughts: true } } },
      fates,
    );

    expect(options.geminiGenerationConfig).toEqual({ thinkingConfig: { includeThoughts: true } });
  });

  it('should drop an includeThoughts flag that is not a boolean', () => {
    const fates: Fate[] = [];

    const options = hubOptionsFromChat(
      { messages: [], generationConfig: { thinkingConfig: { includeThoughts: 'yes' } } },
      fates,
    );

    expect(options.geminiGenerationConfig).toEqual({ thinkingConfig: {} });
  });
});

describe('reading the reasoning summary off a chat request', () => {
  it('should ignore a reasoning exclusion that is not a boolean', () => {
    const fates: Fate[] = [];

    const options = hubOptionsFromChat(
      { messages: [], reasoning: { exclude: 'yes' }, reasoning_effort: 'high' },
      fates,
    );

    expect(options.reasoning).toEqual({ effort: 'high', summary: 'auto' });
  });
});
