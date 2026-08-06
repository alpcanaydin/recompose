import type { EngineGateway, SpendGrant } from '@recompose/contracts';
import type { Context } from 'hono';

import { proxyFetchBoundMs } from '@recompose/contracts';

import type { Crossing, JsonObject, ProviderDialect, ProxyDialect } from './gateway-wire';
import type { TranslationRefusal } from './refusals';
import type { SubscriptionRuntime } from './subscription/reach';

import { translateRequest } from './dialect/dispatcher';
import { translateRequestToGemini } from './dialect/gemini-bridge';
import { answerFrom, unreachableTargetAnswer, unreachableTargetMessage } from './gateway-answers';
import {
  ingressPayload,
  InvalidJsonBodyError,
  readJsonBody,
  refusalResponse,
  requestSessionId,
  virtualNameOf,
  wantsStream,
} from './gateway-wire';
import { emptyConversation, missingCredential, missingTarget, unknownModel } from './refusals';
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
): Promise<Response> {
  const raw = await readJsonBody(c);
  const name = virtualNameOf(raw);
  const virtualModel = gateway.virtualModels.find((candidate) => candidate.id === name);

  if (virtualModel === undefined) {
    return refusalResponse(dialect, unknownModel(name));
  }

  if (virtualModel.target.standing === 'removed') {
    return refusalResponse(dialect, missingTarget(gateway.displayName, name));
  }

  const sessionId = requestSessionId(c, raw);

  const crossing: Crossing = {
    dialect,
    raw,
    gatewayName: gateway.displayName,
    virtualModel: virtualModel.id,
    providerModel: virtualModel.target.providerModel,
    ...(sessionId === undefined ? {} : { sessionId }),
  };

  return forwardGranted(
    crossing,
    await spendGrantFor(gateway.slug, virtualModel.id),
    fetchLike,
    subscriptions,
  );
}

async function forwardGranted(
  crossing: Crossing,
  grant: SpendGrant,
  fetchLike: typeof fetch,
  subscriptions: SubscriptionRuntime,
): Promise<Response> {
  const denied = deniedGrantAnswer(crossing, grant);

  if (grant.verdict !== 'resolved') {
    return denied ?? unreachableTargetAnswer(crossing);
  }

  if (denied !== null) {
    return denied;
  }

  return forwardResolved(crossing, grant, fetchLike, subscriptions);
}

async function forwardResolved(
  crossing: Crossing,
  grant: Extract<SpendGrant, { verdict: 'resolved' }>,
  fetchLike: typeof fetch,
  subscriptions: SubscriptionRuntime,
): Promise<Response> {
  const upstreamDialect = dialectFor(grant);
  const outbound = outboundBodyFor(crossing, upstreamDialect);

  if ('refusal' in outbound) {
    return refusalResponse(crossing.dialect, outbound.refusal);
  }

  const upstream = await reachedUpstream(crossing, grant, outbound.body, fetchLike, subscriptions);

  if (upstream === null) {
    return unreachableTargetAnswer(crossing);
  }

  return answerFrom(crossing, upstream, upstreamDialect);
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

function dialectFor(grant: SpendGrant): ProviderDialect {
  if (grant.verdict !== 'resolved' || grant.spend.custody === 'open') {
    return 'chat-completions';
  }

  const direct = new Map<string, ProviderDialect>([
    ['anthropic', 'anthropic'],
    ['gemini', 'gemini'],
    ['antigravity', 'gemini'],
  ]).get(grant.spend.provider);

  return direct ?? (grant.spend.custody === 'subscription' ? 'responses' : 'chat-completions');
}

async function reachedUpstream(
  crossing: Crossing,
  grant: Extract<SpendGrant, { verdict: 'resolved' }>,
  body: JsonObject,
  fetchLike: typeof fetch,
  subscriptions: SubscriptionRuntime,
): Promise<Response | null> {
  try {
    if (grant.spend.custody === 'subscription') {
      return await reachSubscription(
        grant,
        body,
        subscriptions,
        crossing.sessionId,
        crossing.dialect,
      );
    }

    return await fetchLike(credentialedUrl(grant, crossing), {
      method: 'POST',
      headers: spendHeaders(grant.spend),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(proxyFetchBoundMs),
    });
  } catch (failure) {
    if (failure instanceof InvalidJsonBodyError) {
      throw failure;
    }

    console.error(unreachableTargetMessage(crossing), failure);

    return null;
  }
}

type OutboundBody = { body: JsonObject } | { refusal: TranslationRefusal };

function outboundBodyFor(crossing: Crossing, upstreamDialect: ProviderDialect): OutboundBody {
  const payload = ingressPayload(crossing.dialect, crossing.raw);

  if (payload === null) {
    return { refusal: emptyConversation() };
  }

  const crossed =
    upstreamDialect === 'gemini'
      ? translateRequestToGemini(crossing.dialect, payload)
      : translateRequest(crossing.dialect, upstreamDialect, payload);

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

function credentialedUrl(
  grant: Extract<SpendGrant, { verdict: 'resolved' }>,
  crossing: Crossing,
): string {
  const origin = grant.providerOrigin.replace(/\/+$/u, '');
  const anthropic = grant.spend.custody === 'credentialed' && grant.spend.provider === 'anthropic';

  if (grant.spend.custody === 'credentialed' && grant.spend.provider === 'gemini') {
    return geminiUrl(origin, crossing);
  }

  return `${origin}${anthropic ? '/v1/messages' : '/v1/chat/completions'}`;
}

function geminiUrl(origin: string, crossing: Crossing): string {
  const action = wantsStream(crossing.raw) ? 'streamGenerateContent?alt=sse' : 'generateContent';

  return `${origin}/v1beta/models/${encodeURIComponent(crossing.providerModel)}:${action}`;
}

type GrantedSpend = Extract<SpendGrant, { verdict: 'resolved' }>['spend'];

function spendHeaders(spend: GrantedSpend): Record<string, string> {
  const shared = { 'content-type': 'application/json' };

  if (spend.custody !== 'credentialed') {
    return shared;
  }

  return spend.provider === 'anthropic'
    ? { ...shared, 'x-api-key': spend.credential, 'anthropic-version': '2023-06-01' }
    : spend.provider === 'gemini'
      ? { ...shared, 'x-goog-api-key': spend.credential }
      : { ...shared, authorization: `Bearer ${spend.credential}` };
}
