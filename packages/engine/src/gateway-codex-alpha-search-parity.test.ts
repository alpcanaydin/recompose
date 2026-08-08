import type { SpendGrant } from '@recompose/contracts';

import { afterEach, describe, expect, test } from 'vitest';

import type { SpendGrantContext, SpendGrantFor } from './gateway-proxy';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, aVirtualModel } from './gateway-app.testkit';
import { isJsonObject } from './gateway-wire';
import { providerObservability } from './provider/provider-observability';

const model = aVirtualModel({ target: { standing: 'bound', providerModel: 'gpt-5.6-luna' } });

afterEach(() => {
  providerObservability().clear();
});

function credential(access = 'codex-token', account = 'account-123'): string {
  return JSON.stringify({ tokens: { access_token: access, account_id: account } });
}

function subscription(access = 'codex-token'): SpendGrant {
  return {
    verdict: 'resolved',
    providerOrigin: 'https://chatgpt.com/backend-api/codex',
    spend: {
      custody: 'subscription',
      provider: 'openai',
      accountId: 'acc-codex',
      credential: credential(access),
    },
  };
}

function apiKey(origin = 'https://codex.example.com'): SpendGrant {
  return {
    verdict: 'resolved',
    providerOrigin: origin,
    spend: {
      custody: 'credentialed',
      provider: 'codex-alpha-search',
      accountId: 'acc-alpha',
      credential: 'codex-alpha-key',
    },
  };
}

function fixed(grant: SpendGrant): SpendGrantFor {
  return async () => {
    await Promise.resolve();

    return grant;
  };
}

function capture() {
  const sent: { url: string; init?: RequestInit }[] = [];
  const fetchLike: typeof fetch = async (input, init) => {
    await Promise.resolve();
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    sent.push({ url, ...(init === undefined ? {} : { init }) });

    return Response.json({ results: [{ url: 'https://example.com' }] });
  };

  return { sent, fetchLike };
}

async function ask(
  grantFor: SpendGrantFor,
  fetchLike: typeof fetch,
  body: Record<string, unknown> = { query: 'GPT-5.6' },
  suffix = '',
  headers: Record<string, string> = {},
): Promise<Response> {
  const app = createGatewayApp(aGatewayHolding(model), grantFor, fetchLike);

  return app.request(`http://127.0.0.1:8397/v1/alpha/search${suffix}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function bodyOf(captured: ReturnType<typeof capture>): Record<string, unknown> {
  const body = captured.sent[0]?.init?.body;

  if (typeof body !== 'string') throw new Error('expected body');
  const value: unknown = JSON.parse(body);

  if (!isJsonObject(value)) throw new Error('object');

  return value;
}

describe('Codex alpha search forwarding', () => {
  test('TestCodexAlphaSearchForwardsRequest', async () => {
    const captured = capture();
    const answer = await ask(fixed(subscription()), captured.fetchLike, undefined, '', {
      Session_id: 'session-123',
    });
    const headers = new Headers(captured.sent[0]?.init?.headers);

    expect(answer.status).toBe(200);
    expect(captured.sent[0]?.url).toBe('https://chatgpt.com/backend-api/codex/alpha/search');
    expect(headers.get('Authorization')).toBe('Bearer codex-token');
    expect(headers.get('Chatgpt-Account-Id')).toBe('account-123');
    expect(headers.get('Session_id')).toBe('session-123');
  });

  test('TestCodexAlphaSearchSanitizesResponsesOnlyFields', async () => {
    const captured = capture();

    await ask(fixed(subscription()), captured.fetchLike, {
      id: 'session-123',
      model: 'fast',
      commands: { search_query: [{ q: 'golang' }] },
      prompt_cache_key: 'cache',
      prompt_cache_retention: '24h',
    });
    const body = bodyOf(captured);

    expect(body).toMatchObject({ id: 'session-123', model: 'fast' });
    expect(body).not.toHaveProperty('prompt_cache_key');
    expect(body).not.toHaveProperty('prompt_cache_retention');
  });
});

describe('Codex alpha search credentials', () => {
  test('TestCodexAlphaSearchCredentialPolicy', async () => {
    const captured = capture();
    const ordinary: SpendGrant = {
      verdict: 'resolved',
      providerOrigin: 'https://api.openai.com',
      spend: { custody: 'credentialed', provider: 'openai', credential: 'ordinary' },
    };

    expect((await ask(fixed(ordinary), captured.fetchLike)).status).toBe(503);
    expect(captured.sent).toEqual([]);
  });

  test('TestCodexAlphaSearchOptInAPIKeyUsesConfiguredEndpoint', async () => {
    const captured = capture();

    await ask(fixed(apiKey()), captured.fetchLike);
    expect(captured.sent[0]?.url).toBe('https://codex.example.com/v1/alpha/search');
    expect(new Headers(captured.sent[0]?.init?.headers).get('Authorization')).toBe(
      'Bearer codex-alpha-key',
    );
  });

  test('TestCodexAlphaSearchOptInAPIKeyWithoutBaseURLFailsClosed', async () => {
    const captured = capture();

    expect((await ask(fixed(apiKey('')), captured.fetchLike)).status).toBe(503);
    expect(captured.sent).toEqual([]);
  });
});

describe('Codex alpha search selection and logs', () => {
  test('TestCodexAlphaSearchPassesGinContextToAuthSelection', async () => {
    const captured = capture();
    let selected: SpendGrantContext | undefined;
    const grantFor: SpendGrantFor = async (_slug, _model, context) => {
      await Promise.resolve();
      selected = context;

      return subscription();
    };

    await ask(grantFor, captured.fetchLike, undefined, '?key=home-query-key');
    expect(selected?.query.get('key')).toBe('home-query-key');
  });

  test('TestCodexAlphaSearchUsesRequestIDForSessionAffinity', async () => {
    const captured = capture();
    const sessions = new Map<string, string>();
    const grantFor: SpendGrantFor = async (_slug, _model, context) => {
      await Promise.resolve();
      const id = context?.sessionId ?? 'none';
      const token = sessions.get(id) ?? `token-${String(sessions.size)}`;

      sessions.set(id, token);

      return subscription(token);
    };

    for (const id of ['a', 'b', 'a'])
      await ask(grantFor, captured.fetchLike, { id, model: 'fast' });
    const auth = captured.sent.map((item) => new Headers(item.init?.headers).get('Authorization'));

    expect(auth[0]).not.toBe(auth[1]);
    expect(auth[2]).toBe(auth[0]);
  });

  test('TestCodexAlphaSearchRecordsRequestLog', async () => {
    const captured = capture();
    const answer = await ask(fixed(subscription()), captured.fetchLike);

    await answer.text();
    expect(providerObservability().snapshot()[0]).toMatchObject({
      provider: 'openai',
      method: 'POST',
      status: 200,
    });
    expect(providerObservability().snapshot()[0]).not.toHaveProperty('url');
  });
});

test('TestHealthz', async () => {
  const app = createGatewayApp(aGatewayHolding(model), fixed(subscription()));
  const answer = await app.request('http://127.0.0.1:8397/healthz');

  await expect(answer.json()).resolves.toEqual({ status: 'ok' });
  expect((await app.request('http://127.0.0.1:8397/healthz', { method: 'HEAD' })).status).toBe(200);
});
