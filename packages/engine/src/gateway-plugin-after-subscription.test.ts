import type { SubscriptionProviderId } from '@recompose/contracts';

import { describe, expect, it, vi } from 'vitest';

import type { PluginHost } from './plugin-host';
import type { ProviderRequest } from './subscription/claude-request';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, granting, neverFetches } from './gateway-app.testkit';
import { requestInterceptorHost } from './gateway-plugin-interceptor.testkit';
import {
  antigravityCredential,
  chatRequest,
  claudeAnswer,
  claudeCredential,
  codexCredential,
  runtimeAnswering,
  subscriptionGrant,
  subscriptionModel,
} from './gateway-proxy-subscription.testkit';
import { isJsonObject } from './gateway-wire';
import { ClaudeDiagnostics } from './subscription/claude-diagnostics';

type ProviderFixture = {
  provider: SubscriptionProviderId;
  credential: string;
  dialect: string;
  authorization: string;
};

const fixtures: ProviderFixture[] = [
  {
    provider: 'anthropic',
    credential: claudeCredential('claude-access', 1_800_000_000_000),
    dialect: 'anthropic',
    authorization: 'Bearer claude-access',
  },
  {
    provider: 'openai',
    credential: codexCredential(),
    dialect: 'responses',
    authorization: `Bearer ${['header', 'eyJleHAiOjE4MDAwMDAwMDB9', 'signature'].join('.')}`,
  },
  {
    provider: 'antigravity',
    credential: antigravityCredential(),
    dialect: 'gemini',
    authorization: 'Bearer google-access',
  },
];

describe('subscription after-auth plugin rewriting', () => {
  it.each(fixtures)(
    'should expose and rewrite the $provider provider-ready request',
    async (fixture) => {
      const intercepted: Record<string, unknown>[] = [];
      const plugin = await requestInterceptorHost((request) => {
        intercepted.push(request);

        return {
          Headers: { 'x-after-subscription': [fixture.provider] },
          Body: encodedBody({ ...decodedBody(request), plugin_marker: fixture.provider }),
        };
      });
      const provider = runtimeAnswering(() => providerAnswer(fixture.provider));
      const app = subscriptionApp(fixture, provider.runtime, plugin);

      const answer = await chatRequest(app);

      expect(answer.status).toBe(200);
      expect(intercepted).toHaveLength(1);
      expect(intercepted[0]?.['ToFormat']).toBe(fixture.dialect);
      expect(interceptedHeaders(intercepted[0])['Authorization']).toContain(fixture.authorization);
      expect(provider.sent[0]?.request.headers).toContainEqual([
        'x-after-subscription',
        fixture.provider,
      ]);
      expect(JSON.parse(provider.sent[0]?.request.body ?? '{}')).toMatchObject({
        plugin_marker: fixture.provider,
      });
    },
  );
});

describe('subscription after-auth plugin termination', () => {
  it('should return the plugin response without sending or refreshing', async () => {
    const plugin = await requestInterceptorHost(() => ({
      Terminate: true,
      StatusCode: 409,
      ResponseHeaders: { 'content-type': ['application/json'] },
      ResponseBody: encodedBody({ error: 'subscription blocked' }),
    }));
    const provider = runtimeAnswering(() => claudeAnswer());
    const app = subscriptionApp(fixtures[0], provider.runtime, plugin);

    const answer = await chatRequest(app);

    expect(answer.status).toBe(409);
    await expect(answer.json()).resolves.toEqual({ error: 'subscription blocked' });
    expect(provider.sent).toEqual([]);
  });

  it('should intercept a refreshed retry before its second send', async () => {
    const authorizations: string[] = [];
    const plugin = await requestInterceptorHost((request) => {
      const authorization = interceptedHeaders(request)['Authorization']?.[0] ?? '';

      authorizations.push(authorization);

      return authorization === 'Bearer new-access'
        ? {
            Terminate: true,
            StatusCode: 429,
            ResponseHeaders: { 'content-type': ['application/json'] },
            ResponseBody: encodedBody({ error: 'retry blocked' }),
          }
        : {};
    });
    const runtime = refreshRuntime();
    const fixture: ProviderFixture = {
      provider: 'anthropic',
      credential: claudeCredential('old-access', 1_800_000_000_000),
      dialect: 'anthropic',
      authorization: 'Bearer old-access',
    };
    const app = subscriptionApp(fixture, runtime.value, plugin);

    const answer = await chatRequest(app);

    expect(answer.status).toBe(429);
    expect(authorizations).toEqual(['Bearer old-access', 'Bearer new-access']);
    expect(runtime.send).toHaveBeenCalledOnce();
    expect(runtime.refreshFetch).toHaveBeenCalledOnce();
    await expect(answer.json()).resolves.toEqual({ error: 'retry blocked' });
  });
});

// Helpers

function subscriptionApp(
  fixture: ProviderFixture | undefined,
  runtime: Parameters<typeof createGatewayApp>[3],
  plugins: PluginHost,
) {
  if (fixture === undefined) throw new Error('subscription fixture is missing');

  const grants = granting(subscriptionGrant(fixture.provider, fixture.credential));

  return createGatewayApp(
    aGatewayHolding(subscriptionModel),
    grants.grantFor,
    neverFetches,
    runtime,
    undefined,
    undefined,
    plugins,
  );
}

function interceptedHeaders(
  request: Record<string, unknown> | undefined,
): Record<string, string[]> {
  const headers = request?.['Headers'];

  if (!isJsonObject(headers)) throw new Error('interceptor headers are missing');

  return Object.fromEntries(
    Object.entries(headers).map(([name, values]) => [
      name,
      Array.isArray(values)
        ? values.filter((value): value is string => typeof value === 'string')
        : [],
    ]),
  );
}

function decodedBody(request: Record<string, unknown>): Record<string, unknown> {
  const encoded = request['Body'];
  const decoded =
    typeof encoded === 'string' ? Buffer.from(encoded, 'base64').toString('utf8') : '';
  const value: unknown = JSON.parse(decoded);

  if (!isJsonObject(value)) throw new Error('interceptor body is invalid');

  return value;
}

function encodedBody(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64');
}

function providerAnswer(provider: SubscriptionProviderId): Response {
  if (provider === 'anthropic') return claudeAnswer();

  if (provider === 'antigravity') {
    return Response.json({
      candidates: [{ content: { role: 'model', parts: [{ text: 'ok' }] }, finishReason: 'STOP' }],
    });
  }

  return new Response(
    `data: ${JSON.stringify({
      type: 'response.completed',
      response: {
        id: 'resp_1',
        status: 'completed',
        output: [
          {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'ok' }],
          },
        ],
      },
    })}\n\n`,
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

function refreshRuntime() {
  const send = vi.fn(async (_provider: SubscriptionProviderId, _request: ProviderRequest) => {
    await Promise.resolve();

    return Response.json({ error: 'expired' }, { status: 401 });
  });
  const refreshFetch = vi.fn(async () => {
    await Promise.resolve();

    return Response.json({ access_token: 'new-access', expires_in: 28_800 });
  });

  return {
    send,
    refreshFetch,
    value: {
      send,
      refreshFetch,
      persist: async () => Promise.resolve(),
      now: () => 1_700_000_000_000,
      randomUUID: () => '11111111-1111-4111-8111-111111111111',
      newClaudeDeviceId: () => '0'.repeat(64),
      fetchClaudeProfile: async () =>
        Promise.resolve({ account: { uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } }),
      diagnostics: new ClaudeDiagnostics(),
    },
  };
}
