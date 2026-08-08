import { describe, expect, test } from 'vitest';

import { withClaudeMaxTokens } from './claude-models';

describe('Claude model completion limits', () => {
  test('uses the registered model completion limit when max_tokens is missing', () => {
    expect(withClaudeMaxTokens({ model: 'claude-opus-5' })).toEqual({
      model: 'claude-opus-5',
      max_tokens: 128_000,
    });
  });

  test('preserves an explicit max_tokens value', () => {
    expect(withClaudeMaxTokens({ model: 'claude-opus-5', max_tokens: 2048 })).toEqual({
      model: 'claude-opus-5',
      max_tokens: 2048,
    });
  });

  test('leaves an unregistered model unset', () => {
    expect(withClaudeMaxTokens({ model: 'private-claude-model' })).toEqual({
      model: 'private-claude-model',
    });
  });
});
