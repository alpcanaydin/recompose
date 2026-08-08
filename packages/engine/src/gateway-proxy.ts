import type { EngineGateway, SpendGrant } from '@recompose/contracts';
import type { Context } from 'hono';

import type { Crossing, JsonObject, ProxyDialect } from './gateway-wire';
import type { PluginGatewayTarget } from './plugin-gateway';
import type { PluginHost } from './plugin-host';
import type { AIStudioRelay } from './provider/ai-studio-relay';
import type { SubscriptionRuntime } from './subscription/reach';

import { unreachableTargetAnswer, unreachableTargetMessage } from './gateway-answers';
import { outboundBodyFor } from './gateway-outbound-body';
import { beforeGatewayPlugins } from './gateway-plugin-before';
import { answerThroughPlugins } from './gateway-plugin-response';
import { dialectFor } from './gateway-provider-dialect';
import { gatewayRequestCrossing } from './gateway-request-crossing';
import { InvalidJsonBodyError, refusalResponse } from './gateway-wire';
import { pluginGatewayTarget, reachPluginExecutor } from './plugin-gateway';
import { reachCredentialed } from './provider/credentialed-reach';
import { missingCredential, missingTarget } from './refusals';
import { parseSubscriptionCredential } from './subscription/credentials';
import { reachSubscription, subscriptionRuntime } from './subscription/reach';

export type { SubscriptionRuntime } from './subscription/reach';
export { subscriptionRuntime } from './subscription/reach';

export type SpendGrantContext = {
  headers: Headers;
  query: URLSearchParams;
  sessionId?: string;
};

export type SpendGrantFor = (
  slug: string,
  virtualModel: string,
  context?: SpendGrantContext,
) => Promise<SpendGrant>;

export async function proxyModelRequest(
  c: Context,
  dialect: ProxyDialect,
  gateway: EngineGateway,
  spendGrantFor: SpendGrantFor,
  fetchLike: typeof fetch,
  subscriptions: SubscriptionRuntime = subscriptionRuntime(),
  aiStudio?: AIStudioRelay,
  plugins?: PluginHost,
  modelOverride?: string,
  streamOverride?: boolean,
): Promise<Response> {
  const lookup = await gatewayRequestCrossing(c, dialect, gateway, modelOverride, streamOverride);

  if ('response' in lookup) return lookup.response;

  const { crossing, virtualModel } = lookup;

  const intercepted = await beforeGatewayPlugins(c, crossing, plugins);

  if ('response' in intercepted) return intercepted.response;

  const effectiveCrossing = intercepted.crossing;
  const grant = await spendGrantFor(gateway.slug, virtualModel.id);
  const pluginTarget =
    grant.verdict === 'resolved'
      ? await pluginGatewayTarget(c, effectiveCrossing, grant, plugins)
      : null;

  return forwardGranted(
    effectiveCrossing,
    grant,
    fetchLike,
    subscriptions,
    aiStudio,
    pluginTarget,
    plugins,
  );
}

async function forwardGranted(
  crossing: Crossing,
  grant: SpendGrant,
  fetchLike: typeof fetch,
  subscriptions: SubscriptionRuntime,
  aiStudio?: AIStudioRelay,
  pluginTarget?: PluginGatewayTarget | null,
  plugins?: PluginHost,
): Promise<Response> {
  const denied = deniedGrantAnswer(crossing, grant);

  if (grant.verdict !== 'resolved') {
    return denied ?? unreachableTargetAnswer(crossing);
  }

  if (denied !== null) {
    return denied;
  }

  return forwardResolved(
    crossing,
    grant,
    fetchLike,
    subscriptions,
    aiStudio,
    pluginTarget,
    plugins,
  );
}

async function forwardResolved(
  crossing: Crossing,
  grant: Extract<SpendGrant, { verdict: 'resolved' }>,
  fetchLike: typeof fetch,
  subscriptions: SubscriptionRuntime,
  aiStudio?: AIStudioRelay,
  pluginTarget?: PluginGatewayTarget | null,
  plugins?: PluginHost,
): Promise<Response> {
  if (pluginTarget?.kind === 'executor') {
    return forwardPluginExecutor(crossing, grant, pluginTarget, plugins);
  }

  return forwardProviderResolved(
    effectiveProviderCrossing(crossing, pluginTarget),
    grant,
    fetchLike,
    subscriptions,
    aiStudio,
    plugins,
  );
}

function effectiveProviderCrossing(
  crossing: Crossing,
  target: PluginGatewayTarget | null | undefined,
): Crossing {
  return target?.kind === 'provider' && target.providerModel !== undefined
    ? { ...crossing, providerModel: target.providerModel }
    : crossing;
}

async function forwardProviderResolved(
  effectiveCrossing: Crossing,
  grant: Extract<SpendGrant, { verdict: 'resolved' }>,
  fetchLike: typeof fetch,
  subscriptions: SubscriptionRuntime,
  aiStudio?: AIStudioRelay,
  plugins?: PluginHost,
): Promise<Response> {
  const upstreamDialect = dialectFor(grant, effectiveCrossing.dialect);
  const outbound = outboundBodyFor(
    effectiveCrossing,
    upstreamDialect,
    isAntigravitySubscription(grant),
  );

  if ('refusal' in outbound) {
    return refusalResponse(effectiveCrossing.dialect, outbound.refusal);
  }

  const upstream = await reachedUpstream(
    effectiveCrossing,
    grant,
    outbound.body,
    fetchLike,
    subscriptions,
    aiStudio,
    plugins,
  );

  if (upstream === null) {
    return unreachableTargetAnswer(effectiveCrossing);
  }

  return answerThroughPlugins(effectiveCrossing, upstream, upstreamDialect, plugins);
}

function isAntigravitySubscription(grant: Extract<SpendGrant, { verdict: 'resolved' }>): boolean {
  return grant.spend.custody === 'subscription' && grant.spend.provider === 'antigravity';
}

async function forwardPluginExecutor(
  crossing: Crossing,
  grant: Extract<SpendGrant, { verdict: 'resolved' }>,
  target: Extract<PluginGatewayTarget, { kind: 'executor' }>,
  plugins?: PluginHost,
): Promise<Response> {
  const outbound = outboundBodyFor(crossing, target.inputDialect);

  if ('refusal' in outbound) return refusalResponse(crossing.dialect, outbound.refusal);

  const upstream = await reachPluginExecutor(target, crossing, grant, outbound.body, plugins);

  return answerThroughPlugins(crossing, upstream, target.outputDialect, plugins);
}

function deniedGrantAnswer(crossing: Crossing, grant: SpendGrant): Response | null {
  if (grant.verdict === 'missing-target') {
    return refusalResponse(
      crossing.dialect,
      missingTarget(crossing.gatewayName, crossing.virtualModel),
    );
  }

  if (grant.verdict === 'missing-credential' || hasMalformedSubscription(grant)) {
    return refusalResponse(
      crossing.dialect,
      missingCredential(crossing.gatewayName, crossing.virtualModel),
    );
  }

  return null;
}

function hasMalformedSubscription(grant: SpendGrant): boolean {
  return (
    grant.verdict === 'resolved' &&
    grant.spend.custody === 'subscription' &&
    parseSubscriptionCredential(grant.spend.provider, grant.spend.credential) === null
  );
}

async function reachedUpstream(
  crossing: Crossing,
  grant: Extract<SpendGrant, { verdict: 'resolved' }>,
  body: JsonObject,
  fetchLike: typeof fetch,
  subscriptions: SubscriptionRuntime,
  aiStudio?: AIStudioRelay,
  plugins?: PluginHost,
): Promise<Response | null> {
  try {
    if (grant.spend.custody === 'subscription') {
      return await reachSubscription(
        grant,
        body,
        subscriptions,
        crossing.sessionId,
        crossing.dialect,
        crossing.replayScopeId,
        crossing.responsesLite,
        { crossing, plugins },
      );
    }

    return await reachCredentialed(crossing, grant, body, fetchLike, aiStudio, plugins);
  } catch (failure) {
    if (failure instanceof InvalidJsonBodyError) {
      throw failure;
    }

    console.error(unreachableTargetMessage(crossing), failure);

    return null;
  }
}
