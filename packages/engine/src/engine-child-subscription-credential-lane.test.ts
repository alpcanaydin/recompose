import {
  engineSpendRequestSchema,
  engineSubscriptionCredentialUpdateSchema,
} from '@recompose/contracts';
import { expect, test, vi } from 'vitest';

import type { SubscriptionRuntime } from './gateway-proxy';

import { attachEngineChild } from './engine-child';
import { aParent, reportsReach } from './engine-child.testkit';
import {
  aGatewayHolding,
  aLoopbackCapturing,
  aVirtualModel,
  neverFetches,
  openedApp,
} from './gateway-app.testkit';
import { ClaudeDiagnostics } from './subscription/claude-diagnostics';

const credential = JSON.stringify({
  account_uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  claude_device_ids: ['0'.repeat(64)],
  claudeAiOauth: {
    accessToken: 'old-access',
    refreshToken: 'old-refresh',
    expiresAt: 1_600_000_000_000,
  },
});

function subscriptionOverrides(send: SubscriptionRuntime['send']) {
  return {
    send,
    refreshFetch: async () => {
      await Promise.resolve();

      return Response.json({ access_token: 'new-access', expires_in: 28_800 });
    },
    now: () => 1_700_000_000_000,
    randomUUID: () => '11111111-1111-4111-8111-111111111111',
    newClaudeDeviceId: () => '0'.repeat(64),
    fetchClaudeProfile: async () => {
      await Promise.resolve();

      return { account: { uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } };
    },
    diagnostics: new ClaudeDiagnostics(),
  };
}

function grantExpiredSubscription(parent: ReturnType<typeof aParent>, answers: string): void {
  parent.send({
    kind: 'spend-grant',
    answers,
    grant: {
      verdict: 'resolved',
      providerOrigin: 'https://api.anthropic.com',
      spend: {
        custody: 'subscription',
        provider: 'anthropic',
        accountId: 'acc-claude',
        credential,
      },
    },
  });
}

test('a refreshed token is not spent until main acknowledges durable storage', async () => {
  const parent = aParent();
  const capturing = aLoopbackCapturing();
  const send = vi.fn<SubscriptionRuntime['send']>(async () => {
    await Promise.resolve();

    return Response.json({
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      content: [],
      stop_reason: 'end_turn',
    });
  });

  attachEngineChild(
    parent.port,
    capturing.openListeners,
    neverFetches,
    subscriptionOverrides(send),
  );
  parent.send({
    kind: 'start',
    id: 'd1',
    gateway: aGatewayHolding(aVirtualModel()),
  });

  await reportsReach(parent, 1);

  const answering = openedApp(capturing).request('http://127.0.0.1:8397/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({ model: 'fast', messages: [{ role: 'user', content: 'hello' }] }),
  });

  await reportsReach(parent, 2);

  const spend = engineSpendRequestSchema.parse(parent.reports[1]);

  grantExpiredSubscription(parent, spend.id);

  await reportsReach(parent, 3);

  const update = engineSubscriptionCredentialUpdateSchema.parse(parent.reports[2]);

  expect(update).toMatchObject({
    provider: 'anthropic',
    accountId: 'acc-claude',
  });
  expect(update.credential).toContain('new-access');
  expect(send).not.toHaveBeenCalled();

  parent.send({
    kind: 'subscription-credential-updated',
    answers: update.id,
    verdict: 'stored',
  });

  expect((await answering).status).toBe(200);
  expect(send).toHaveBeenCalledOnce();
});
