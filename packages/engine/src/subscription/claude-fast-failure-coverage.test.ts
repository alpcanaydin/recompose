import { describe, expect, it } from 'vitest';

import { ClaudeRequestScopedError, claudeRequestUsesFastMode } from './claude-fast-failure';

describe('ClaudeRequestScopedError: a failure that carried no error object', () => {
  it('names the failed operation when the cause has no message of its own', () => {
    expect(new ClaudeRequestScopedError('socket hung up').message).toBe(
      'Claude fast request failed',
    );
  });

  it('keeps the message when the cause is a real error', () => {
    expect(new ClaudeRequestScopedError(new Error('overloaded')).message).toBe('overloaded');
  });
});

describe('claudeRequestUsesFastMode: the beta list a caller sent', () => {
  it('reads a beta list without the fast-mode flag as an ordinary request', () => {
    expect(claudeRequestUsesFastMode({ betas: ['context-1m-2026-01-01'] })).toBe(false);
  });

  it('reads the fast-mode beta as a fast request', () => {
    expect(claudeRequestUsesFastMode({ betas: ['fast-mode-2026-02-01'] })).toBe(true);
  });
});
