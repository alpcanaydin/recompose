import { describe, expect, test } from 'vitest';

import type { ResolvedGrant, SubscriptionRuntime } from './reach';

import { reachCodexCompact } from './reach-compact';
import { reachAntigravityCount, reachSubscriptionCount } from './reach-count';
import { reachCodexImage } from './reach-image';
import { subscriptionRuntime } from './subscription-runtime';

type Custody = 'anthropic' | 'antigravity' | 'openai';
type Reach = (grant: ResolvedGrant, runtime: SubscriptionRuntime) => Promise<Response>;

const COMPACT_REFUSAL = 'a non-Codex subscription reached the compact transport';
const IMAGE_REFUSAL = 'a non-Codex subscription reached the image transport';
const COUNT_REFUSAL = 'a non-Claude subscription reached the native token-count transport';
const ANTIGRAVITY_REFUSAL = 'a non-Antigravity subscription reached its token-count transport';

function openGrant(): ResolvedGrant {
  return {
    verdict: 'resolved',
    providerOrigin: 'https://example.test',
    spend: { custody: 'open' },
  };
}

function subscriptionGrant(provider: Custody, credential = '{}'): ResolvedGrant {
  return {
    verdict: 'resolved',
    providerOrigin: 'https://example.test',
    spend: { custody: 'subscription', provider, accountId: 'account-1', credential },
  };
}

function silentRuntime(): SubscriptionRuntime {
  const runtime = subscriptionRuntime();

  runtime.send = async () => {
    await Promise.resolve();

    throw new Error('the refused transport reached the network');
  };

  return runtime;
}

const compact: Reach = async (grant, runtime) => {
  const answer = await reachCodexCompact(grant, { model: 'gpt-5' }, runtime, 'session-1');

  return answer;
};

const image: Reach = async (grant, runtime) => {
  const body = { prompt: 'a gateway' };
  const path = '/images/generations';
  const answer = await reachCodexImage(grant, path, body, new Headers(), false, runtime);

  return answer;
};

const claudeCount: Reach = async (grant, runtime) => {
  const body = { model: 'claude-sonnet-4-6' };
  const answer = await reachSubscriptionCount(grant, body, runtime, 'session-1');

  return answer;
};

const antigravityCount: Reach = async (grant, runtime) => {
  const body = { model: 'gemini-3.6-flash' };
  const answer = await reachAntigravityCount(grant, body, runtime, 'scope-1');

  return answer;
};

const openGrants: [string, Reach, string][] = [
  ['the Codex compact transport', compact, COMPACT_REFUSAL],
  ['the Codex image transport', image, IMAGE_REFUSAL],
  ['the Claude token-count transport', claudeCount, COUNT_REFUSAL],
  ['the Antigravity token-count transport', antigravityCount, ANTIGRAVITY_REFUSAL],
];

const foreignSubscriptions: [string, Reach, Custody, string][] = [
  ['the Codex compact transport', compact, 'anthropic', COMPACT_REFUSAL],
  ['the Codex image transport', image, 'antigravity', IMAGE_REFUSAL],
  ['the Claude token-count transport', claudeCount, 'openai', COUNT_REFUSAL],
  ['the Antigravity token-count transport', antigravityCount, 'anthropic', ANTIGRAVITY_REFUSAL],
];

describe('a subscription transport refuses a grant it does not serve', () => {
  test.each(openGrants)('%s refuses an open grant', async (_label, reach, message) => {
    await expect(reach(openGrant(), silentRuntime())).rejects.toThrow(message);
  });

  test.each(foreignSubscriptions)(
    '%s refuses a %s subscription',
    async (_label, reach, provider, message) => {
      await expect(reach(subscriptionGrant(provider), silentRuntime())).rejects.toThrow(message);
    },
  );
});

const unreadable: [string, Reach, Custody][] = [
  ['the Codex compact transport', compact, 'openai'],
  ['the Codex image transport', image, 'openai'],
  ['the Claude token-count transport', claudeCount, 'anthropic'],
  ['the Antigravity token-count transport', antigravityCount, 'antigravity'],
];

describe('a subscription transport refuses a credential it cannot read', () => {
  test.each(unreadable)('%s reports an unreadable credential', async (_label, reach, provider) => {
    const attempt = reach(subscriptionGrant(provider, '{}'), silentRuntime());

    await expect(attempt).rejects.toThrow('the subscription credential could not be read');
  });
});
