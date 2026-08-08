import type { SubscriptionProviderId } from '@recompose/contracts';

import { describe, expect, it } from 'vitest';

import type { ProviderRequest } from './claude-request';

import { ClaudeRequestScopedError } from './claude-fast-failure';
import { sendInterceptedSubscription } from './intercepted-send';

function providerRequest(): ProviderRequest {
  return { url: 'https://example.test/v1/messages', headers: [], body: '{}' };
}

async function dyingTransport(): Promise<Response> {
  await Promise.resolve();

  throw new Error('the provider connection died');
}

async function sendingThatFails(provider: SubscriptionProviderId, body: Record<string, unknown>) {
  const attempt = await sendInterceptedSubscription(
    provider,
    'account',
    body,
    providerRequest(),
    dyingTransport,
  );

  return attempt;
}

describe('a subscription send whose transport dies', () => {
  it('raises the transport failure as it stands for an ordinary Claude turn', async () => {
    const attempt = sendingThatFails('anthropic', { model: 'claude-opus-5' });

    await expect(attempt).rejects.toThrow('the provider connection died');
    await expect(attempt).rejects.not.toBeInstanceOf(ClaudeRequestScopedError);
  });

  it('raises the transport failure as it stands for another provider', async () => {
    const attempt = sendingThatFails('openai', { model: 'gpt-5.4', speed: 'fast' });

    await expect(attempt).rejects.toThrow('the provider connection died');
  });
});
