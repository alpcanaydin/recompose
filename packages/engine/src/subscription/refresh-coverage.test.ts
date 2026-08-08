import type { AccountTransportPolicy } from '@recompose/contracts';

import { describe, expect, test } from 'vitest';

import type { RefreshFetch } from './refresh';

import { refreshSubscriptionCredential } from './refresh';

function claudeBlobFor(refreshToken: string): string {
  return JSON.stringify({
    claudeAiOauth: { accessToken: 'old-access', refreshToken, expiresAt: 1_700_000_000_000 },
  });
}

function codexBlobFor(refreshToken: string): string {
  return JSON.stringify({ tokens: { access_token: 'old-access', refresh_token: refreshToken } });
}

function answering(body: unknown): RefreshFetch {
  return async () => {
    await Promise.resolve();

    return new Response(JSON.stringify(body), { status: 200 });
  };
}

function rateLimited(headers: Record<string, string>): RefreshFetch {
  return async () => {
    await Promise.resolve();

    return new Response('slow down', { status: 429, headers });
  };
}

describe('reading the token payload a provider sends back', () => {
  test('a payload that is not an object is refused as malformed', async () => {
    await expect(
      refreshSubscriptionCredential('openai', codexBlobFor('codex-not-object'), answering([1, 2])),
    ).rejects.toThrow('subscription token refresh returned a malformed response');
  });

  test('a payload whose lifetime is not a number is refused as malformed', async () => {
    await expect(
      refreshSubscriptionCredential(
        'openai',
        codexBlobFor('codex-bad-expiry'),
        answering({ access_token: 'new-access', expires_in: '3600' }),
      ),
    ).rejects.toThrow('subscription token refresh returned a malformed response');
  });
});

describe('refusing to refresh a credential that cannot be refreshed', () => {
  test('a credential carrying no refresh token is refused before any request', async () => {
    await expect(
      refreshSubscriptionCredential(
        'openai',
        JSON.stringify({ tokens: { access_token: 'only-access' } }),
        answering({ access_token: 'new-access', expires_in: 3600 }),
      ),
    ).rejects.toThrow('subscription credential has no refresh token');
  });
});

describe('honoring the wait a rate-limited Claude refresh asks for', () => {
  test('a refusal naming no wait still blocks the next attempt', async () => {
    const blob = claudeBlobFor('claude-no-retry-header');

    await expect(refreshSubscriptionCredential('anthropic', blob, rateLimited({}))).rejects.toThrow(
      'status 429',
    );
    await expect(
      refreshSubscriptionCredential('anthropic', blob, answering({}), 1_000),
    ).rejects.toThrow('subscription token refresh failed with status 429');
  });

  test('a wait given as a date is measured against the moment of refusal', async () => {
    const blob = claudeBlobFor('claude-date-retry');
    const headers = { 'Retry-After': new Date(600_000).toUTCString() };

    await expect(
      refreshSubscriptionCredential('anthropic', blob, rateLimited(headers), 0),
    ).rejects.toThrow('status 429');
    await expect(
      refreshSubscriptionCredential('anthropic', blob, answering({}), 100_000),
    ).rejects.toThrow('subscription token refresh failed with status 429');
  });

  test('an unreadable wait falls back to the millisecond header', async () => {
    const blob = claudeBlobFor('claude-unreadable-retry');
    const headers = { 'Retry-After': 'soon', 'Retry-After-Ms': '20000' };

    await expect(
      refreshSubscriptionCredential('anthropic', blob, rateLimited(headers), 0),
    ).rejects.toThrow('status 429');
    await expect(
      refreshSubscriptionCredential('anthropic', blob, answering({}), 19_000),
    ).rejects.toThrow('subscription token refresh failed with status 429');
  });
});

describe('refreshing through an account transport policy', () => {
  test('the policy reaches the transport and the rotated token is stored', async () => {
    const policy = { mode: 'proxy', url: 'http://127.0.0.1:9' } satisfies AccountTransportPolicy;
    const seen: (AccountTransportPolicy | undefined)[] = [];
    const fetchLike: RefreshFetch = async (_url, _init, transportPolicy) => {
      seen.push(transportPolicy);
      await Promise.resolve();

      return new Response(JSON.stringify({ access_token: 'fresh-access', expires_in: 3600 }), {
        status: 200,
      });
    };

    const blob = await refreshSubscriptionCredential(
      'openai',
      codexBlobFor('codex-policy'),
      fetchLike,
      0,
      policy,
    );

    expect(seen).toStrictEqual([policy]);
    expect(blob).toContain('fresh-access');
  });
});
