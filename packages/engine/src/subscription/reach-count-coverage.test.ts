import { describe, expect, test } from 'vitest';

import type { JsonObject } from '../gateway-wire';
import type { ProviderRequest } from './claude-request';
import type { ResolvedGrant, SubscriptionRuntime } from './reach';

import { reachAntigravityCount, reachSubscriptionCount } from './reach-count';
import { subscriptionRuntime } from './subscription-runtime';

type Custody = 'anthropic' | 'antigravity' | 'openai';

const credentials: Record<Custody, string> = {
  anthropic: JSON.stringify({
    claudeAiOauth: { accessToken: 'claude-access', refreshToken: 'claude-refresh' },
  }),
  antigravity: JSON.stringify({
    access_token: 'antigravity-access',
    refresh_token: 'antigravity-refresh',
    project_id: 'project-1',
    expired: '2099-01-01T00:00:00.000Z',
  }),
  openai: JSON.stringify({
    tokens: { access_token: 'codex-access', refresh_token: 'codex-refresh' },
  }),
};

function grantFor(provider: Custody): ResolvedGrant {
  return {
    verdict: 'resolved',
    providerOrigin: 'https://example.test',
    spend: {
      custody: 'subscription',
      provider,
      accountId: 'account-1',
      credential: credentials[provider],
    },
  };
}

function countingRuntime(sent: ProviderRequest[]): SubscriptionRuntime {
  const runtime = subscriptionRuntime();

  runtime.send = async (_provider, request) => {
    sent.push(request);
    await Promise.resolve();

    return new Response('{"input_tokens":7}', { status: 200 });
  };

  return runtime;
}

function unpairedHistory(): JsonObject {
  return {
    model: 'gemini-3.6-flash',
    contents: [{ role: 'user', parts: [{ functionResponse: { id: 'a', name: 'read' } }] }],
  };
}

describe('a token-count transport refuses a subscription it does not serve', () => {
  test('the Claude transport refuses an OpenAI subscription', async () => {
    const counting = reachSubscriptionCount(
      grantFor('openai'),
      { model: 'gpt-5' },
      countingRuntime([]),
    );

    await expect(counting).rejects.toThrow(
      'a non-Claude subscription reached the native token-count transport',
    );
  });

  test('the Antigravity transport refuses a Claude subscription', async () => {
    const counting = reachAntigravityCount(
      grantFor('anthropic'),
      { model: 'claude-sonnet-4-6' },
      countingRuntime([]),
    );

    await expect(counting).rejects.toThrow(
      'a non-Antigravity subscription reached its token-count transport',
    );
  });
});

describe('an Antigravity count refuses an unpaired function history', () => {
  test('a function response without its call is turned away before anything is sent', async () => {
    const sent: ProviderRequest[] = [];

    const answer = await reachAntigravityCount(
      grantFor('antigravity'),
      unpairedHistory(),
      countingRuntime(sent),
      'scope-1',
    );

    expect(answer.status).toBe(400);
    expect(sent).toEqual([]);
    await expect(answer.json()).resolves.toHaveProperty('error.status', 'INVALID_ARGUMENT');
  });
});

describe('an authorized count answer stands without a refresh', () => {
  test('the Claude count answer is returned on the first send', async () => {
    const sent: ProviderRequest[] = [];

    const answer = await reachSubscriptionCount(
      grantFor('anthropic'),
      { model: 'claude-sonnet-4-6' },
      countingRuntime(sent),
      'session-1',
    );

    expect(answer.status).toBe(200);
    expect(sent).toHaveLength(1);
  });

  test('the Antigravity count answer is returned on the first send', async () => {
    const sent: ProviderRequest[] = [];

    const answer = await reachAntigravityCount(
      grantFor('antigravity'),
      { model: 'gemini-3.6-flash', contents: [] },
      countingRuntime(sent),
      'scope-1',
    );

    expect(answer.status).toBe(200);
    expect(sent).toHaveLength(1);
  });
});
