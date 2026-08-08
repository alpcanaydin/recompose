import { describe, expect, test } from 'vitest';

import type { ProviderRequest } from './claude-request';
import type { ResolvedGrant, SubscriptionRuntime } from './reach';

import { reachCodexCompact } from './reach-compact';
import { reachAntigravityCount, reachSubscriptionCount } from './reach-count';
import { reachCodexImage } from './reach-image';
import { subscriptionRuntime } from './subscription-runtime';

type Custody = 'anthropic' | 'antigravity' | 'openai';
type Reach = (grant: ResolvedGrant, runtime: SubscriptionRuntime) => Promise<Response>;
type Transport = { runtime: SubscriptionRuntime; persisted: string[]; sent: ProviderRequest[] };

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

function grantFor(provider: Custody, credential = credentials[provider]): ResolvedGrant {
  return {
    verdict: 'resolved',
    providerOrigin: 'https://example.test',
    spend: { custody: 'subscription', provider, accountId: 'account-1', credential },
  };
}

function bearer(request: ProviderRequest | undefined): string {
  return request === undefined ? '' : (new Headers(request.headers).get('authorization') ?? '');
}

function tokenAnswer(accessToken: string): Response {
  return new Response(
    JSON.stringify({ access_token: accessToken, refresh_token: 'rotated', expires_in: 3600 }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

function refreshingTransport(accessToken: string): Transport {
  const runtime = subscriptionRuntime();
  const persisted: string[] = [];
  const sent: ProviderRequest[] = [];

  runtime.send = async (_provider, request) => {
    sent.push(request);
    await Promise.resolve();

    return sent.length === 1 ? new Response('denied', { status: 401 }) : new Response('{}');
  };

  runtime.refreshFetch = async () => {
    await Promise.resolve();

    return tokenAnswer(accessToken);
  };

  runtime.persist = async (_provider, _accountId, credential) => {
    persisted.push(credential);
    await Promise.resolve();
  };

  return { runtime, persisted, sent };
}

const compact: Reach = async (grant, runtime) => {
  const answer = await reachCodexCompact(grant, { model: 'gpt-5' }, runtime, 'session-1');

  return answer;
};

const image: Reach = async (grant, runtime) => {
  const body = { prompt: 'a gateway' };
  const answer = await reachCodexImage(grant, '/images/edits', body, new Headers(), true, runtime);

  return answer;
};

const claudeCount: Reach = async (grant, runtime) => {
  const body = { model: 'claude-sonnet-4-6' };
  const answer = await reachSubscriptionCount(grant, body, runtime, 'session-1');

  return answer;
};

const bearerCarriers: [string, Reach, Custody, string][] = [
  ['the Codex compact transport', compact, 'openai', 'codex-renewed'],
  ['the Codex image transport', image, 'openai', 'image-renewed'],
  ['the Claude token-count transport', claudeCount, 'anthropic', 'claude-renewed'],
];

describe('an unauthorized subscription answer is retried on a refreshed credential', () => {
  test.each(bearerCarriers)(
    '%s re-sends under the refreshed access token',
    async (_label, reach, provider, renewed) => {
      const transport = refreshingTransport(renewed);

      const answer = await reach(grantFor(provider), transport.runtime);

      expect(answer.status).toBe(200);
      expect(transport.sent).toHaveLength(2);
      expect(bearer(transport.sent[1])).toContain(renewed);
      expect(transport.persisted[0]).toContain(renewed);
    },
  );

  test('the Antigravity token-count transport re-sends on the refreshed credential', async () => {
    const transport = refreshingTransport('antigravity-renewed');

    const answer = await reachAntigravityCount(
      grantFor('antigravity'),
      { model: 'gemini-3.6-flash', contents: [] },
      transport.runtime,
      'scope-1',
    );

    expect(answer.status).toBe(200);
    expect(transport.sent).toHaveLength(2);
    expect(transport.persisted[0]).toContain('antigravity-renewed');
  });
});

describe('an unauthorized answer without a refresh token stands', () => {
  test('the Codex compact transport returns the refusal unchanged', async () => {
    const runtime = subscriptionRuntime();
    const sent: ProviderRequest[] = [];
    const grant = grantFor('openai', JSON.stringify({ tokens: { access_token: 'codex-access' } }));

    runtime.send = async (_provider, request) => {
      sent.push(request);
      await Promise.resolve();

      return new Response('denied', { status: 401 });
    };

    const answer = await compact(grant, runtime);

    expect(answer.status).toBe(401);
    expect(sent).toHaveLength(1);
  });
});
