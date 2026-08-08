import { describe, expect, it } from 'vitest';

import type { Fate } from './fates';

import { chatToolChoiceInto } from './chat-completions-request-fields-encode';

describe('chatToolChoiceInto writes a web-search choice Chat Completions cannot name', () => {
  it('falls back to letting the model choose and records the mapping', () => {
    const fates: Fate[] = [];
    const encoded = chatToolChoiceInto({ messages: [], toolChoice: { type: 'web_search' } }, fates);

    expect(encoded).toEqual({ tool_choice: 'auto' });
    expect(fates).toContainEqual({
      field: 'toolChoice',
      disposition: 'mapped',
      to: 'tool_choice',
    });
  });
});
