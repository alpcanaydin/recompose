import type { SubscriptionProviderId } from '@recompose/contracts';

import type { Crossing, JsonObject, ProviderDialect } from '../gateway-wire';
import type { PluginHost } from '../plugin-host';
import type { PluginHeaderMap } from '../plugin-wire';
import type { ProviderRequest } from './claude-request';

import { afterAuthPlugins } from '../plugin-after-auth';
import { notePluginExecution } from '../plugin-execution-context';
import { claudeRequestUsesFastMode, ClaudeRequestScopedError } from './claude-fast-failure';
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
  failureScope?: 'request' | 'credential';
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

type PreparedRequest = { bodyChanged: boolean; request: ProviderRequest };

async function interceptedRequest(
  provider: SubscriptionProviderId,
  request: ProviderRequest,
  context: SubscriptionPluginContext,
): Promise<PreparedRequest | Response> {
  const intercepted = await afterAuthPlugins(
    context.crossing,
    providerDialect(provider),
    pluginHeaders(request.headers),
    new TextEncoder().encode(request.body),
    context.plugins,
  );

  if ('response' in intercepted) return intercepted.response;

  const body = new TextDecoder().decode(intercepted.body);

  return {
    bodyChanged: body !== request.body,
    request: { ...request, headers: providerHeaders(intercepted.headers), body },
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
    context === undefined
      ? { bodyChanged: false, request }
      : await interceptedRequest(provider, request, context);

  if (prepared instanceof Response) return { answer: prepared, terminated: true };

  if (context !== undefined) {
    notePluginExecution(
      context.crossing,
      pluginHeaders(prepared.request.headers),
      new TextEncoder().encode(prepared.request.body),
      prepared.bodyChanged,
    );
  }

  return observedAttempt(provider, accountId, body, prepared.request, send);
}

async function observedAttempt(
  provider: SubscriptionProviderId,
  accountId: string,
  body: JsonObject,
  request: ProviderRequest,
  send: SubscriptionSend,
): Promise<SubscriptionAttempt> {
  try {
    const answer = await sendObservedSubscription(provider, accountId, body, request, send);

    return { answer, terminated: false };
  } catch (error) {
    if (provider !== 'anthropic' || !claudeRequestUsesFastMode(body)) throw error;

    throw new ClaudeRequestScopedError(error);
  }
}
