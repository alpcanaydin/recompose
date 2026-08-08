import { describe, expect, test } from 'vitest';

import type { ResolvedGrant, SubscriptionRuntime } from './reach';

import { reachSubscription } from './reach';
import { subscriptionRuntime } from './subscription-runtime';

const REFUSAL = 'a non-subscription spend reached the subscription transport';

function silentRuntime(): SubscriptionRuntime {
  const runtime = subscriptionRuntime();

  runtime.send = async () => {
    await Promise.resolve();

    throw new Error('the refused transport reached the network');
  };

  return runtime;
}

describe('the subscription transport refuses a spend it does not serve', () => {
  test('an open spend never reaches the network', async () => {
    const grant: ResolvedGrant = {
      verdict: 'resolved',
      providerOrigin: 'https://example.test',
      spend: { custody: 'open' },
    };

    await expect(reachSubscription(grant, { model: 'gpt-5' }, silentRuntime())).rejects.toThrow(
      REFUSAL,
    );
  });

  test('a credentialed spend never reaches the network', async () => {
    const grant: ResolvedGrant = {
      verdict: 'resolved',
      providerOrigin: 'https://example.test',
      spend: { custody: 'credentialed', provider: 'openai', credential: 'sk-live-40d1' },
    };

    await expect(reachSubscription(grant, { model: 'gpt-5' }, silentRuntime())).rejects.toThrow(
      REFUSAL,
    );
  });
});
