import { describe, expect, test, vi } from 'vitest';

import type { ProviderRequest } from './subscription/claude-request';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, granting, neverFetches } from './gateway-app.testkit';
import {
  chatRequest,
  claudeAnswer,
  claudeCredential,
  runtimeAnswering,
  subscriptionGrant,
  subscriptionModel,
} from './gateway-proxy-subscription.testkit';

function claudeApp(credential: string, runtime: Parameters<typeof createGatewayApp>[3]) {
  const grants = granting(subscriptionGrant('anthropic', credential));

  return createGatewayApp(
    aGatewayHolding(subscriptionModel),
    grants.grantFor,
    neverFetches,
    runtime,
  );
}

function orderedRefreshRuntime(order: string[]) {
  const refreshFetch = vi.fn(async () => {
    await Promise.resolve();
    order.push('refresh');

    return Response.json({ access_token: 'new-access', expires_in: 28_800 });
  });
  const persist = vi.fn(async () => {
    await Promise.resolve();
    order.push('persist');
  });
  const send = vi.fn(async (_provider: string, request: ProviderRequest) => {
    await Promise.resolve();
    order.push('send');
    expect(request.headers).toContainEqual(['Authorization', 'Bearer new-access']);

    return claudeAnswer();
  });

  return {
    persist,
    runtime: {
      send,
      refreshFetch,
      persist,
      now: () => 1_700_000_000_000,
      randomUUID: () => '11111111-1111-4111-8111-111111111111',
    },
  };
}

describe('serving a Claude subscription target', () => {
  test('a malformed provider credential is refused before any network request', async () => {
    const provider = runtimeAnswering(() => Response.json({}));
    const app = claudeApp('{"claudeAiOauth":null}', provider.runtime);
    const answer = await chatRequest(app);

    expect(answer.status).toBe(502);
    expect(await answer.json()).toMatchObject({ error: { code: 'missing_credential' } });
    expect(provider.sent).toEqual([]);
  });

  test('a Chat Completions request crosses to Messages and its answer crosses back', async () => {
    const provider = runtimeAnswering(() => claudeAnswer([{ type: 'text', text: 'hello back' }]));
    const app = claudeApp(claudeCredential('claude-access', 1_800_000_000_000), provider.runtime);
    const answer = await chatRequest(app);

    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]?.provider).toBe('anthropic');
    expect(JSON.parse(provider.sent[0]?.request.body ?? '{}')).toMatchObject({
      model: 'claude-sonnet-4-5',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
    });
    expect(await answer.json()).toMatchObject({
      choices: [{ message: { role: 'assistant', content: 'hello back' } }],
    });
    expect(provider.persist).not.toHaveBeenCalled();
  });
});

describe('rotating a Claude subscription credential', () => {
  test('an expired token is persisted before the provider request is sent', async () => {
    const order: string[] = [];
    const ordered = orderedRefreshRuntime(order);
    const app = claudeApp(claudeCredential('old-access', 1_600_000_000_000), ordered.runtime);
    const answer = await chatRequest(app);

    expect(answer.status).toBe(200);
    expect(order).toEqual(['refresh', 'persist', 'send']);
    expect(ordered.persist).toHaveBeenCalledWith(
      'anthropic',
      'acc-anthropic',
      expect.stringContaining('new-access'),
    );
  });

  test('one unauthorized answer refreshes and retries once', async () => {
    const refreshFetch = vi.fn(async () => {
      await Promise.resolve();

      return Response.json({ access_token: 'new-access', expires_in: 28_800 });
    });
    const persist = vi.fn(async () => {
      await Promise.resolve();
    });
    const send = vi.fn(async () => {
      await Promise.resolve();

      return claudeAnswer();
    });

    send.mockResolvedValueOnce(Response.json({ error: 'expired' }, { status: 401 }));

    const app = claudeApp(claudeCredential('old-access', 1_800_000_000_000), {
      send,
      refreshFetch,
      persist,
      now: () => 1_700_000_000_000,
      randomUUID: () => '11111111-1111-4111-8111-111111111111',
    });
    const answer = await chatRequest(app);

    expect(answer.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(2);
    expect(refreshFetch).toHaveBeenCalledOnce();
    expect(persist).toHaveBeenCalledOnce();
  });
});
