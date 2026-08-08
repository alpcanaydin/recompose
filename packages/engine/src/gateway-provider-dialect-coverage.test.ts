import type { SpendGrant } from '@recompose/contracts';

import { describe, expect, it } from 'vitest';

import { dialectFor } from './gateway-provider-dialect';

describe('dialectFor: a spend request the router could not resolve', () => {
  it('falls back to the neutral dialect when no target answered', () => {
    expect(dialectFor({ verdict: 'missing-target' }, 'anthropic')).toBe('chat-completions');
  });

  it('falls back to the neutral dialect when the target has no credential', () => {
    expect(dialectFor({ verdict: 'missing-credential' }, 'responses')).toBe('chat-completions');
  });
});

describe('dialectFor: a resolved subscription target', () => {
  it('speaks Gemini to an Antigravity subscription whatever the caller spoke', () => {
    const grant: SpendGrant = {
      verdict: 'resolved',
      providerOrigin: 'https://example.test',
      spend: {
        custody: 'subscription',
        provider: 'antigravity',
        accountId: 'account-1',
        credential: '{"type":"antigravity"}',
      },
    };

    expect(dialectFor(grant, 'anthropic')).toBe('gemini');
  });
});
