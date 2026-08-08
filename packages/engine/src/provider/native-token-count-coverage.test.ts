import type { SpendGrant } from '@recompose/contracts';
import type { Context } from 'hono';

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import type { SubscriptionRuntime } from '../gateway-proxy';
import type { JsonObject } from '../gateway-wire';

import { runtimeAnswering } from '../gateway-proxy-subscription.testkit';
import { AIStudioRelay } from './ai-studio-relay';
import { nativeProviderCount } from './native-token-count';

type ResolvedGrant = Extract<SpendGrant, { verdict: 'resolved' }>;

describe('an account with no native token count', () => {
  it('should leave a credentialed provider the gateway counts itself', async () => {
    const answer = await counted(keyGrant('openai', 'sk-key'), askingAboutOtters(), stubFetch({}));

    expect(answer).toBeNull();
  });

  it('should leave an open account to the gateway', async () => {
    const openGrant: ResolvedGrant = {
      verdict: 'resolved',
      providerOrigin: 'http://127.0.0.1:11434',
      spend: { custody: 'open' },
    };

    const answer = await counted(openGrant, askingAboutOtters(), stubFetch({}));

    expect(answer).toBeNull();
  });
});

describe('counting tokens with a Gemini key', () => {
  it('should report the provider total as the Anthropic input count', async () => {
    const answer = await counted(
      keyGrant('gemini', 'goog-key'),
      askingAboutOtters(),
      stubFetch({ totalTokens: 24 }),
    );

    expect(answer?.status).toBe(200);
    await expect(answer?.json()).resolves.toEqual({ input_tokens: 24 });
  });

  it('should pass a provider answer that names no total straight through', async () => {
    const answer = await counted(
      keyGrant('gemini', 'goog-key'),
      askingAboutOtters(),
      stubFetch({ error: { message: 'quota' } }),
    );

    await expect(answer?.json()).resolves.toEqual({ error: { message: 'quota' } });
  });

  it('should refuse a body it cannot read as an Anthropic request', async () => {
    const answer = await counted(keyGrant('gemini', 'goog-key'), {}, stubFetch({}));

    expect(answer?.status).toBe(400);
  });
});

describe('counting tokens with a Vertex credential', () => {
  it('should refuse a credential that carries nothing to sign with', async () => {
    const answer = await counted(keyGrant('vertex', '   '), askingAboutOtters(), stubFetch({}));

    expect(answer?.status).toBe(400);
  });

  it('should report the provider total for a readable credential', async () => {
    const answer = await counted(
      keyGrant('vertex', 'vertex-api-key'),
      askingAboutOtters(),
      stubFetch({ totalTokens: 12 }),
    );

    await expect(answer?.json()).resolves.toEqual({ input_tokens: 12 });
  });
});

describe('counting tokens through the AI Studio relay', () => {
  it('should refuse when no browser relay is connected', async () => {
    const answer = await counted(keyGrant('aistudio', ''), askingAboutOtters(), stubFetch({}));

    expect(answer?.status).toBe(400);
  });

  it('should report the total the connected relay answers with', async () => {
    const relay = answeringRelay({ totalTokens: 31 });

    const answer = await counted(
      keyGrant('aistudio', ''),
      askingAboutOtters(),
      stubFetch({}),
      relay,
    );

    await expect(answer?.json()).resolves.toEqual({ input_tokens: 31 });
  });
});

describe('counting tokens through an Antigravity subscription', () => {
  it('should refuse a body it cannot read as an Anthropic request', async () => {
    const subscription: ResolvedGrant = {
      verdict: 'resolved',
      providerOrigin: 'https://cloudcode-pa.googleapis.com',
      spend: {
        custody: 'subscription',
        provider: 'antigravity',
        accountId: 'acc-antigravity',
        credential: '{}',
      },
    };

    const answer = await counted(subscription, {}, stubFetch({}));

    expect(answer?.status).toBe(400);
  });
});

function answeringRelay(body: unknown): AIStudioRelay {
  const relay = new AIStudioRelay({ id: () => 'request-1' });

  relay.attach(
    {
      send: () => {
        relay.receive(
          'acc-aistudio',
          JSON.stringify({ id: 'request-1', type: 'http_response', payload: { body: json(body) } }),
        );
      },
      close: () => undefined,
    },
    'acc-aistudio',
  );

  return relay;
}

async function counted(
  grant: ResolvedGrant,
  raw: JsonObject,
  fetchLike: typeof fetch,
  relay?: AIStudioRelay,
): Promise<Response | null> {
  return nativeProviderCount(
    await requestContext(),
    raw,
    grant,
    'gemini-3-pro',
    subscriptions(),
    fetchLike,
    relay,
  );
}

function subscriptions(): SubscriptionRuntime {
  return runtimeAnswering(() => Response.json({})).runtime;
}

function keyGrant(provider: string, credential: string): ResolvedGrant {
  return {
    verdict: 'resolved',
    providerOrigin: 'https://generativelanguage.googleapis.com/',
    spend: {
      custody: 'credentialed',
      provider,
      credential,
      accountId: `acc-${provider}`,
    },
  };
}

function askingAboutOtters(): JsonObject {
  return {
    model: 'claude-sonnet-4',
    max_tokens: 16,
    messages: [{ role: 'user', content: 'tell me about otters' }],
  };
}

function stubFetch(body: unknown): typeof fetch {
  return async () => Promise.resolve(new Response(json(body)));
}

function json(body: unknown): string {
  return JSON.stringify(body);
}

async function requestContext(): Promise<Context> {
  const captured: Context[] = [];
  const app = new Hono();

  app.all('*', (c) => {
    captured.push(c);

    return c.text('ok');
  });

  await app.request('http://127.0.0.1:8397/v1/messages/count_tokens', { method: 'POST' });

  const context = captured[0];

  if (context === undefined) throw new Error('the request never reached a handler');

  return context;
}
