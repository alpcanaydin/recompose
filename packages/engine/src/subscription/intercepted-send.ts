import type { SubscriptionProviderId } from '@recompose/contracts';

import type { Crossing, JsonObject, ProviderDialect } from '../gateway-wire';
import type { PluginHost } from '../plugin-host';
import type { PluginHeaderMap } from '../plugin-wire';
import type { ProviderRequest } from './claude-request';

import { afterAuthPlugins } from '../plugin-after-auth';
import { sendObservedSubscription } from './observed-send';

type SubscriptionSend = (
  provider: SubscriptionProviderId,
  request: ProviderRequest,
) => Promise<Response>;

export type SubscriptionPluginContext = {
  crossing: Crossing;
  plugins: PluginHost | undefined;
};

export type SubscriptionAttempt = {
  answer: Response;
  terminated: boolean;
};

function providerDialect(provider: SubscriptionProviderId): ProviderDialect {
  if (provider === 'anthropic') return 'anthropic';
  if (provider === 'antigravity') return 'gemini';

  return 'responses';
}

function pluginHeaders(headers: readonly [string, string][]): PluginHeaderMap {
  const result: PluginHeaderMap = {};

  for (const [name, value] of headers) result[name] = [...(result[name] ?? []), value];

  return result;
}

function providerHeaders(headers: PluginHeaderMap): [string, string][] {
  return Object.entries(headers).flatMap(([name, values]) =>
    values.map((value): [string, string] => [name, value]),
  );
}

async function interceptedRequest(
  provider: SubscriptionProviderId,
  request: ProviderRequest,
  context: SubscriptionPluginContext,
): Promise<ProviderRequest | Response> {
  const intercepted = await afterAuthPlugins(
    context.crossing,
    providerDialect(provider),
    pluginHeaders(request.headers),
    new TextEncoder().encode(request.body),
    context.plugins,
  );

  return 'response' in intercepted
    ? intercepted.response
    : {
        ...request,
        headers: providerHeaders(intercepted.headers),
        body: new TextDecoder().decode(intercepted.body),
      };
}

export async function sendInterceptedSubscription(
  provider: SubscriptionProviderId,
  accountId: string,
  body: JsonObject,
  request: ProviderRequest,
  send: SubscriptionSend,
  context?: SubscriptionPluginContext,
): Promise<SubscriptionAttempt> {
  const prepared =
    context === undefined ? request : await interceptedRequest(provider, request, context);

  if (prepared instanceof Response) return { answer: prepared, terminated: true };

  return {
    answer: await sendObservedSubscription(provider, accountId, body, prepared, send),
    terminated: false,
  };
}
