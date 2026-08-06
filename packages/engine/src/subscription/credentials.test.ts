import { describe, expect, test } from 'vitest';

import { parseSubscriptionCredential, refreshedCredentialBlob } from './credentials';

function jwtWith(claims: Record<string, unknown>): string {
  return `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
}

describe('reading the credential bundle written by each provider tool', () => {
  test('Claude Code credentials expose the OAuth tokens and millisecond expiry', () => {
    const parsed = parseSubscriptionCredential(
      'anthropic',
      JSON.stringify({
        claudeAiOauth: {
          accessToken: 'claude-access',
          refreshToken: 'claude-refresh',
          expiresAt: 1_800_000_000_000,
          subscriptionType: 'max',
        },
      }),
    );

    expect(parsed).toEqual({
      accessToken: 'claude-access',
      refreshToken: 'claude-refresh',
      expiresAt: 1_800_000_000_000,
    });
  });

  test('Codex credentials expose the account id and access-token JWT expiry', () => {
    const accessToken = jwtWith({ exp: 1_800_000_000 });
    const parsed = parseSubscriptionCredential(
      'openai',
      JSON.stringify({
        tokens: {
          access_token: accessToken,
          refresh_token: 'codex-refresh',
          account_id: 'acct-work',
        },
      }),
    );

    expect(parsed).toEqual({
      accessToken,
      refreshToken: 'codex-refresh',
      accountId: 'acct-work',
      expiresAt: 1_800_000_000_000,
    });
  });

  test('a malformed document authorizes no request', () => {
    for (const [provider, blob] of [
      ['anthropic', 'not-json'],
      ['anthropic', '{"claudeAiOauth":{"accessToken":"   "}}'],
      ['openai', '{"tokens":null}'],
      ['openai', '{"tokens":{"access_token":42}}'],
    ] as const) {
      expect(parseSubscriptionCredential(provider, blob)).toBeNull();
    }
  });
});

describe('writing a rotated Claude token back into its provider document', () => {
  test('a Claude refresh preserves unrelated account metadata', () => {
    const original = JSON.stringify({
      theme: 'dark',
      claudeAiOauth: {
        accessToken: 'old-access',
        refreshToken: 'old-refresh',
        expiresAt: 1,
        subscriptionType: 'max',
      },
    });

    const refreshed: unknown = JSON.parse(
      refreshedCredentialBlob(
        'anthropic',
        original,
        { accessToken: 'new-access', refreshToken: 'new-refresh', expiresInSeconds: 28_800 },
        1_700_000_000_000,
      ),
    );

    expect(refreshed).toEqual({
      theme: 'dark',
      claudeAiOauth: {
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        expiresAt: 1_700_028_800_000,
        subscriptionType: 'max',
      },
    });
  });
});

describe('writing rotated Codex tokens back into their provider document', () => {
  test('a Codex refresh preserves the old refresh token when the response rotates none', () => {
    const original = JSON.stringify({
      OPENAI_API_KEY: null,
      tokens: {
        id_token: 'old-id',
        access_token: 'old-access',
        refresh_token: 'old-refresh',
        account_id: 'acct-work',
      },
      last_refresh: 'old-time',
    });

    const refreshed: unknown = JSON.parse(
      refreshedCredentialBlob(
        'openai',
        original,
        { accessToken: 'new-access', idToken: 'new-id', expiresInSeconds: 3600 },
        1_700_000_000_000,
      ),
    );

    expect(refreshed).toEqual({
      OPENAI_API_KEY: null,
      tokens: {
        id_token: 'new-id',
        access_token: 'new-access',
        refresh_token: 'old-refresh',
        account_id: 'acct-work',
      },
      last_refresh: '2023-11-14T22:13:20.000Z',
    });
  });
});
