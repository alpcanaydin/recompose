import type { SubscriptionProviderId } from '@recompose/contracts';

import { describe, expect, it } from 'vitest';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, granting, neverFetches } from './gateway-app.testkit';
import {
  antigravityCredential,
  chatRequest,
  claudeCredential,
  codexCredential,
  runtimeAnswering,
  subscriptionGrant,
  subscriptionModel,
  subscriptionProviderAnswer,
} from './gateway-proxy-subscription.testkit';
import { isJsonObject } from './gateway-wire';
import {
  decodedPluginBytes,
  encodedPluginBytes,
  responseHost,
  responsePlugin,
} from './plugin-response-interceptor.testkit';

type Fixture = {
  provider: SubscriptionProviderId;
  credential: string;
  authorization: string;
  requestProperty: string;
};

const fixtures: Fixture[] = [
  {
    provider: 'anthropic',
    credential: claudeCredential('claude-access', 1_800_000_000_000),
    authorization: 'Bearer claude-access',
    requestProperty: 'metadata',
  },
  {
    provider: 'openai',
    credential: codexCredential(),
    authorization: `Bearer ${['header', 'eyJleHAiOjE4MDAwMDAwMDB9', 'signature'].join('.')}`,
    requestProperty: 'store',
  },
  {
    provider: 'antigravity',
    credential: antigravityCredential(),
    authorization: 'Bearer google-access',
    requestProperty: 'project',
  },
];

describe('subscription response plugin rewriting', () => {
  it.each(fixtures)(
    'should rewrite $provider responses with provider-ready request context',
    async (fixture) => {
      const seen: Record<string, unknown>[] = [];
      const plugin = responsePlugin({ response: true }, (_method, request) => {
        seen.push(request);
        const body = parsedBody(request['Body']);

        return {
          Body: encodedPluginBytes(
            JSON.stringify({ ...body, subscription_plugin: fixture.provider }),
          ),
        };
      });
      const host = await responseHost([['response', 1, plugin]]);
      const provider = runtimeAnswering(() => subscriptionProviderAnswer(fixture.provider));
      const grants = granting(subscriptionGrant(fixture.provider, fixture.credential));
      const app = createGatewayApp(
        aGatewayHolding(subscriptionModel),
        grants.grantFor,
        neverFetches,
        provider.runtime,
        undefined,
        undefined,
        host,
      );

      const answer = await chatRequest(app);

      await expect(answer.json()).resolves.toMatchObject({
        subscription_plugin: fixture.provider,
      });
      expect(headerValue(seen[0]?.['RequestHeaders'], 'authorization')).toBe(fixture.authorization);
      expect(parsedBody(seen[0]?.['RequestBody'])).toHaveProperty(fixture.requestProperty);
      expect(parsedBody(seen[0]?.['OriginalRequest'])).toHaveProperty('model', 'fast');
    },
  );
});

// Helpers

function parsedBody(value: unknown): Record<string, unknown> {
  const parsed: unknown = JSON.parse(decodedPluginBytes(value));

  if (!isJsonObject(parsed)) throw new Error('subscription plugin body is invalid');

  return parsed;
}

function headerValue(value: unknown, name: string): string | undefined {
  if (!isJsonObject(value)) return undefined;

  const entry = Object.entries(value).find(([key]) => key.toLowerCase() === name);

  return firstString(entry?.[1]);
}

function firstString(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;

  return value.find((item): item is string => typeof item === 'string');
}
