import { describe, expect, it } from 'vitest';

import { activeClaudeThinking, enabledClaudeThinking } from './summary-policy-claude';

describe('activeClaudeThinking: the shapes that mean thinking is on', () => {
  it('reads an adaptive block as thinking already on', () => {
    expect(activeClaudeThinking({ thinking: { type: 'adaptive' } })).toBe(true);
  });

  it('reads an enabled block with no budget as thinking already on', () => {
    expect(activeClaudeThinking({ thinking: { type: 'enabled' } })).toBe(true);
  });

  it('reads an enabled block with an unlimited budget as thinking already on', () => {
    expect(activeClaudeThinking({ thinking: { type: 'enabled', budget_tokens: -1 } })).toBe(true);
  });

  it('reads an enabled block with no budget left as thinking off', () => {
    expect(activeClaudeThinking({ thinking: { type: 'enabled', budget_tokens: 0 } })).toBe(false);
  });
});

describe('enabledClaudeThinking: the block to send when the caller asked for none', () => {
  it('falls back to a budgeted block when the request names no model', () => {
    expect(enabledClaudeThinking(undefined)).toEqual({ type: 'enabled', budget_tokens: 1024 });
  });

  it('asks the newest Claude models to decide the budget themselves', () => {
    expect(enabledClaudeThinking('claude-opus-5')).toEqual({ type: 'adaptive' });
  });
});
