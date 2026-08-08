import {
  engineSpendRequestSchema,
  engineSubscriptionCredentialUpdateSchema,
} from '@recompose/contracts';
import { afterEach, expect, test, vi } from 'vitest';

import type { SubscriptionRuntime } from './gateway-proxy';

import { attachEngineChild } from './engine-child';
import { aParent, type Parent, reportsReach } from './engine-child.testkit';
import {
  aGatewayHolding,
  aLoopbackCapturing,
  aVirtualModel,
  neverFetches,
  openedApp,
} from './gateway-app.testkit';
import { ClaudeDiagnostics } from './subscription/claude-diagnostics';

function anExpiredCredential(): string {
  return JSON.stringify({
    account_uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    claude_device_ids: ['0'.repeat(64)],
    claudeAiOauth: {
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      expiresAt: 1_600_000_000_000,
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
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

function grantExpiredSubscription(parent: Parent, answers: string): void {
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
        credential: anExpiredCredential(),
      },
    },
  });
}

function anAnsweringSend(): SubscriptionRuntime['send'] {
  return vi.fn<SubscriptionRuntime['send']>(async () => {
    await Promise.resolve();

    return Response.json({
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      content: [],
      stop_reason: 'end_turn',
    });
  });
}

async function anAskAwaitingItsCredential(send: SubscriptionRuntime['send']) {
  const parent = aParent();
  const capturing = aLoopbackCapturing();

  attachEngineChild(
    parent.port,
    capturing.openListeners,
    neverFetches,
    subscriptionOverrides(send),
  );
  parent.send({ kind: 'start', id: 'd1', gateway: aGatewayHolding(aVirtualModel()) });

  await reportsReach(parent, 1);

  const answering = openedApp(capturing).request('http://127.0.0.1:8397/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({ model: 'fast', messages: [{ role: 'user', content: 'hello' }] }),
  });

  await reportsReach(parent, 2);
  grantExpiredSubscription(parent, engineSpendRequestSchema.parse(parent.reports[1]).id);
  await reportsReach(parent, 3);

  return {
    parent,
    answering,
    update: engineSubscriptionCredentialUpdateSchema.parse(parent.reports[2]),
  };
}

test('a refreshed token main could not store is never spent upstream', async () => {
  const send = anAnsweringSend();
  const lane = await anAskAwaitingItsCredential(send);

  lane.parent.send({
    kind: 'subscription-credential-updated',
    answers: lane.update.id,
    verdict: 'failed',
  });

  const answer = await lane.answering;

  expect(answer.status).toBe(502);
  await expect(answer.json()).resolves.toHaveProperty('error');
  expect(send).not.toHaveBeenCalled();
});

test('a credential verdict answering no open request leaves the waiting ask alone', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);

  const send = anAnsweringSend();
  const lane = await anAskAwaitingItsCredential(send);

  lane.parent.send({
    kind: 'subscription-credential-updated',
    answers: 'a-verdict-nobody-waits-on',
    verdict: 'stored',
  });
  lane.parent.send({
    kind: 'subscription-credential-updated',
    answers: lane.update.id,
    verdict: 'stored',
  });

  expect((await lane.answering).status).toBe(200);
  expect(send).toHaveBeenCalledOnce();
});
