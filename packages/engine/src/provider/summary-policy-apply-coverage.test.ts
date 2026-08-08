import { describe, expect, it } from 'vitest';

import { applySummaryPolicy } from './summary-policy-apply';

describe('a Claude summary policy the caller never states', () => {
  it('should leave the body untouched when the gateway inferred nothing', () => {
    const body = { model: 'claude-opus-4-6' };

    expect(applySummaryPolicy(body, 'anthropic', { mode: 'unspecified' })).toEqual({
      body,
      inferredClaudeThinking: false,
    });
  });

  it('should withdraw a thinking block the gateway itself inferred', () => {
    const result = applySummaryPolicy(
      { model: 'claude-opus-4-6', thinking: { type: 'enabled', budget_tokens: 1024 } },
      'anthropic',
      { mode: 'unspecified' },
      { inferredClaudeThinking: true },
    );

    expect(result).toEqual({ body: { model: 'claude-opus-4-6' }, inferredClaudeThinking: false });
  });
});

describe('a Claude summary policy over thinking the caller never turned on', () => {
  it('should leave thinking off when summaries are disabled', () => {
    const body = { model: 'claude-opus-4-6' };

    expect(applySummaryPolicy(body, 'anthropic', { mode: 'disabled' })).toEqual({
      body,
      inferredClaudeThinking: false,
    });
  });

  it('should turn adaptive thinking on for a model that reasons on its own', () => {
    const result = applySummaryPolicy(
      {},
      'anthropic',
      { mode: 'enabled' },
      { model: 'claude-sonnet-5' },
    );

    expect(result).toEqual({
      body: { thinking: { type: 'adaptive', display: 'summarized' } },
      inferredClaudeThinking: true,
    });
  });

  it('should turn budgeted thinking on for a model that needs a budget', () => {
    const result = applySummaryPolicy(
      {},
      'anthropic',
      { mode: 'enabled' },
      { model: 'claude-opus-4-6' },
    );

    expect(result).toEqual({
      body: { thinking: { type: 'enabled', budget_tokens: 1024, display: 'summarized' } },
      inferredClaudeThinking: true,
    });
  });
});

describe('a Claude summary policy over thinking the caller turned on', () => {
  it('should omit the summary while leaving the caller budget in place', () => {
    const result = applySummaryPolicy(
      { thinking: { type: 'enabled', budget_tokens: 4096 } },
      'anthropic',
      { mode: 'disabled' },
    );

    expect(result).toEqual({
      body: { thinking: { type: 'enabled', budget_tokens: 4096, display: 'omitted' } },
      inferredClaudeThinking: false,
    });
  });

  it('should keep reporting thinking as inferred once the gateway said so', () => {
    const result = applySummaryPolicy(
      { thinking: { type: 'adaptive' } },
      'anthropic',
      { mode: 'enabled' },
      { inferredClaudeThinking: true },
    );

    expect(result).toEqual({
      body: { thinking: { type: 'adaptive', display: 'summarized' } },
      inferredClaudeThinking: true,
    });
  });
});
