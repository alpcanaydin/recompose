import type { EngineGateway, SpendGrant } from '@recompose/contracts';
import type { Context } from 'hono';

import type { RequestOf } from './dialect/dispatcher';
import type { Crossing, JsonObject, ProviderDialect, ProxyDialect } from './gateway-wire';
import type { PluginGatewayTarget } from './plugin-gateway';
import type { PluginHost } from './plugin-host';
import type { AIStudioRelay } from './provider/ai-studio-relay';
import type { TranslationRefusal } from './refusals';
import type { SubscriptionRuntime } from './subscription/reach';

import { translateRequest } from './dialect/dispatcher';
import { translateRequestToGemini } from './dialect/gemini-bridge';
import { answerFrom, unreachableTargetAnswer, unreachableTargetMessage } from './gateway-answers';
import { beforeGatewayPlugins } from './gateway-plugin-before';
import { gatewayRequestCrossing } from './gateway-request-crossing';
import { ingressPayload, InvalidJsonBodyError, refusalResponse, wantsStream } from './gateway-wire';
import { pluginGatewayTarget, reachPluginExecutor } from './plugin-gateway';
import { reachCredentialed } from './provider/credentialed-reach';
import { credentialedDialect } from './provider/credentialed-target';
import { emptyConversation, missingCredential, missingTarget } from './refusals';
import { parseSubscriptionCredential } from './subscription/credentials';
import { reachSubscription, subscriptionRuntime } from './subscription/reach';

export type { SubscriptionRuntime } from './subscription/reach';
export { subscriptionRuntime } from './subscription/reach';

export type SpendGrantFor = (slug: string, virtualModel: string) => Promise<SpendGrant>;

export async function proxyModelRequest(
  c: Context,
  dialect: ProxyDialect,
  gateway: EngineGateway,
  spendGrantFor: SpendGrantFor,
  fetchLike: typeof fetch,
  subscriptions: SubscriptionRuntime = subscriptionRuntime(),
  aiStudio?: AIStudioRelay,
  plugins?: PluginHost,
): Promise<Response> {
  const lookup = await gatewayRequestCrossing(c, dialect, gateway);

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

  return forwardGranted(effectiveCrossing, grant, fetchLike, subscriptions, aiStudio, pluginTarget);
}

async function forwardGranted(
  crossing: Crossing,
  grant: SpendGrant,
  fetchLike: typeof fetch,
  subscriptions: SubscriptionRuntime,
  aiStudio?: AIStudioRelay,
  pluginTarget?: PluginGatewayTarget | null,
): Promise<Response> {
  const denied = deniedGrantAnswer(crossing, grant);

  if (grant.verdict !== 'resolved') {
    return denied ?? unreachableTargetAnswer(crossing);
  }

  if (denied !== null) {
    return denied;
  }

  return forwardResolved(crossing, grant, fetchLike, subscriptions, aiStudio, pluginTarget);
}

async function forwardResolved(
  crossing: Crossing,
  grant: Extract<SpendGrant, { verdict: 'resolved' }>,
  fetchLike: typeof fetch,
  subscriptions: SubscriptionRuntime,
  aiStudio?: AIStudioRelay,
  pluginTarget?: PluginGatewayTarget | null,
): Promise<Response> {
  if (pluginTarget?.kind === 'executor') {
    return forwardPluginExecutor(crossing, grant, pluginTarget);
  }

  return forwardProviderResolved(
    effectiveProviderCrossing(crossing, pluginTarget),
    grant,
    fetchLike,
    subscriptions,
    aiStudio,
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
): Promise<Response> {
  const upstreamDialect = dialectFor(grant, effectiveCrossing.dialect);
  const outbound = outboundBodyFor(effectiveCrossing, upstreamDialect);

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
  );

  if (upstream === null) {
    return unreachableTargetAnswer(effectiveCrossing);
  }

  return answerFrom(effectiveCrossing, upstream, upstreamDialect);
}

async function forwardPluginExecutor(
  crossing: Crossing,
  grant: Extract<SpendGrant, { verdict: 'resolved' }>,
  target: Extract<PluginGatewayTarget, { kind: 'executor' }>,
): Promise<Response> {
  const outbound = outboundBodyFor(crossing, target.inputDialect);

  if ('refusal' in outbound) return refusalResponse(crossing.dialect, outbound.refusal);

  const upstream = await reachPluginExecutor(target, crossing, grant, outbound.body);

  return answerFrom(crossing, upstream, target.outputDialect);
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

function subscriptionDialect(provider: string): ProviderDialect {
  if (provider === 'anthropic') return 'anthropic';
  if (provider === 'antigravity') return 'gemini';

  return 'responses';
}

function dialectFor(grant: SpendGrant, sourceDialect: ProxyDialect): ProviderDialect {
  if (grant.verdict !== 'resolved') return 'chat-completions';
  if (grant.spend.custody === 'open') return 'chat-completions';

  if (grant.spend.custody === 'credentialed') {
    return credentialedDialect(grant.spend.provider, sourceDialect);
  }

  return subscriptionDialect(grant.spend.provider);
}

async function reachedUpstream(
  crossing: Crossing,
  grant: Extract<SpendGrant, { verdict: 'resolved' }>,
  body: JsonObject,
  fetchLike: typeof fetch,
  subscriptions: SubscriptionRuntime,
  aiStudio?: AIStudioRelay,
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
      );
    }

    return await reachCredentialed(crossing, grant, body, fetchLike, aiStudio);
  } catch (failure) {
    if (failure instanceof InvalidJsonBodyError) {
      throw failure;
    }

    console.error(unreachableTargetMessage(crossing), failure);

    return null;
  }
}

type OutboundBody = { body: JsonObject } | { refusal: TranslationRefusal };

function rawResponsesBody(crossing: Crossing, upstreamDialect: ProviderDialect): JsonObject | null {
  return crossing.dialect === 'responses' && upstreamDialect === 'responses'
    ? { ...crossing.raw, model: crossing.providerModel, ...streamAsk(crossing.raw) }
    : null;
}

function crossedRequest(
  crossing: Crossing,
  upstreamDialect: ProviderDialect,
  payload: RequestOf[ProxyDialect],
) {
  return upstreamDialect === 'gemini'
    ? translateRequestToGemini(crossing.dialect, payload)
    : translateRequest(crossing.dialect, upstreamDialect, payload);
}

function outboundBodyFor(crossing: Crossing, upstreamDialect: ProviderDialect): OutboundBody {
  const raw = rawResponsesBody(crossing, upstreamDialect);

  if (raw !== null) return { body: raw };

  const payload = ingressPayload(crossing.dialect, crossing.raw);

  if (payload === null) {
    return { refusal: emptyConversation() };
  }

  const crossed = crossedRequest(crossing, upstreamDialect, payload);

  if ('outcome' in crossed) {
    return { body: { ...crossing.raw, model: crossing.providerModel } };
  }

  if ('refusal' in crossed) {
    return { refusal: crossed.refusal };
  }

  return {
    body: { ...crossed.value, model: crossing.providerModel, ...streamAsk(crossing.raw) },
  };
}

function streamAsk(raw: JsonObject): { stream?: boolean } {
  return wantsStream(raw) ? { stream: true } : {};
}
