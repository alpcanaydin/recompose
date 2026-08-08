import type { EngineVirtualModel, SpendGrant } from '@recompose/contracts';

import { afterEach, describe, expect, it } from 'vitest';

import type { SpendGrantFor } from './gateway-proxy';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, aVirtualModel } from './gateway-app.testkit';
import { providerObservability } from './provider/provider-observability';

afterEach(() => {
  providerObservability().clear();
});

function subscriptionGrant(credential: string): SpendGrant {
  return {
    verdict: 'resolved',
    providerOrigin: 'https://chatgpt.com/backend-api/codex',
    spend: { custody: 'subscription', provider: 'openai', accountId: 'acc', credential },
  };
}

function fixed(grant: SpendGrant): SpendGrantFor {
  return async () => Promise.resolve(grant);
}

function capture() {
  const sent: RequestInit[] = [];
  const fetchLike: typeof fetch = async (_input, init) => {
    sent.push(init ?? {});

    return Promise.resolve(Response.json({ results: [] }));
  };

  return { sent, fetchLike };
}

async function askSearch(
  grantFor: SpendGrantFor,
  fetchLike: typeof fetch,
  body: string,
  headers: Record<string, string> = {},
  models: readonly EngineVirtualModel[] = [aVirtualModel()],
): Promise<Response> {
  const app = createGatewayApp(aGatewayHolding(...models), grantFor, fetchLike);

  return app.request('http://127.0.0.1:8397/v1/alpha/search', { method: 'POST', headers, body });
}

function tokenCredential(accountId?: string): string {
  return JSON.stringify({
    tokens: {
      access_token: 'codex-token',
      ...(accountId === undefined ? {} : { account_id: accountId }),
    },
  });
}

describe('Refusing a Codex alpha search the gateway cannot serve', () => {
  it('should reject a search request that is not a JSON object', async () => {
    const answer = await askSearch(
      fixed(subscriptionGrant(tokenCredential())),
      capture().fetchLike,
      '"query"',
    );

    expect(answer.status).toBe(400);
    await expect(answer.json()).resolves.toEqual({ error: 'Invalid search request' });
  });

  it('should report no Codex target when the gateway holds no virtual model', async () => {
    const answer = await askSearch(
      fixed(subscriptionGrant(tokenCredential())),
      capture().fetchLike,
      '{"query":"GPT"}',
      {},
      [],
    );

    expect(answer.status).toBe(503);
    await expect(answer.json()).resolves.toEqual({ error: 'Codex target unavailable' });
  });

  it('should report no Codex authorization when the grant is refused', async () => {
    const refused: SpendGrant = { verdict: 'missing-credential' };
    const answer = await askSearch(fixed(refused), capture().fetchLike, '{"query":"GPT"}');

    expect(answer.status).toBe(503);
    await expect(answer.json()).resolves.toEqual({ error: 'Codex auth unavailable' });
  });

  it('should report no Codex alpha search when the subscription credential is unreadable', async () => {
    const captured = capture();
    const answer = await askSearch(
      fixed(subscriptionGrant('not-a-credential')),
      captured.fetchLike,
      '{"query":"GPT"}',
    );

    expect(answer.status).toBe(503);
    expect(captured.sent).toEqual([]);
  });
});

describe('Forwarding a Codex alpha search', () => {
  it('should leave out the account header when the subscription names no account', async () => {
    const captured = capture();

    await askSearch(
      fixed(subscriptionGrant(tokenCredential())),
      captured.fetchLike,
      '{"query":"GPT"}',
    );

    expect(new Headers(captured.sent[0]?.headers).get('Chatgpt-Account-Id')).toBeNull();
  });

  it('should leave out the session header when the caller sent none', async () => {
    const captured = capture();

    await askSearch(
      fixed(subscriptionGrant(tokenCredential('acc-1'))),
      captured.fetchLike,
      '{"query":"GPT"}',
    );

    expect(new Headers(captured.sent[0]?.headers).get('Session_id')).toBeNull();
  });

  it('should log the virtual model when the request names no model', async () => {
    const captured = capture();

    const answer = await askSearch(
      fixed(subscriptionGrant(tokenCredential('acc-1'))),
      captured.fetchLike,
      '{"model":7}',
    );

    await answer.text();
    expect(providerObservability().snapshot()[0]).toMatchObject({ model: 'fast' });
  });

  it('should serve the virtual model the request names among several', async () => {
    const captured = capture();
    const wide = aVirtualModel({ id: 'wide' });

    const answer = await askSearch(
      fixed(subscriptionGrant(tokenCredential('acc-1'))),
      captured.fetchLike,
      '{"model":"wide"}',
      {},
      [aVirtualModel(), wide],
    );

    await answer.text();
    expect(providerObservability().snapshot()[0]).toMatchObject({ model: 'wide' });
  });
});

describe('Surfacing an unexpected Codex alpha search failure', () => {
  it('should let a transport failure travel past the search handler', async () => {
    const failing: typeof fetch = async () => Promise.reject(new Error('upstream unreachable'));

    const asked = askSearch(
      fixed(subscriptionGrant(tokenCredential('acc-1'))),
      failing,
      '{"query":"GPT"}',
    );

    await expect(asked).rejects.toThrow('upstream unreachable');
  });
});
