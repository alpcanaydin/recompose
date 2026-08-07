import type { EngineGateway, SpendGrant } from '@recompose/contracts';
import type { Context } from 'hono';

import { proxyFetchBoundMs } from '@recompose/contracts';

import type { RequestOf } from './dialect/dispatcher';
import type { Crossing, JsonObject, ProviderDialect, ProxyDialect } from './gateway-wire';
import type { TranslationRefusal } from './refusals';
import type { SubscriptionRuntime } from './subscription/reach';

import { translateRequest } from './dialect/dispatcher';
import { translateRequestToGemini } from './dialect/gemini-bridge';
import { answerFrom, unreachableTargetAnswer, unreachableTargetMessage } from './gateway-answers';
import { requestSessions } from './gateway-session';
import {
  ingressPayload,
  InvalidJsonBodyError,
  readJsonBody,
  refusalResponse,
  virtualNameOf,
  wantsStream,
} from './gateway-wire';
import {
  credentialedDialect,
  credentialedRequestBody,
  credentialedRequestHeaders,
  credentialedRequestUrl,
} from './provider/credentialed-target';
import { observeKimiReplay } from './provider/kimi-replay-runtime';
import { withXaiRetryAfter } from './provider/xai-response';
import { restoreXAIToolResponse } from './provider/xai-tool-response';
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

  const crossing: Crossing = {
    dialect,
    raw,
    gatewayName: gateway.displayName,
    virtualModel: virtualModel.id,
    providerModel: virtualModel.target.providerModel,
    ...requestSessions(c, raw),
    responsesLite: responsesLite(c),
    anthropicBeta: c.req.header('anthropic-beta'),
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
  const upstreamDialect = dialectFor(grant, crossing.dialect);
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

    const answer = await fetchLike(credentialedRequestUrl(grant, crossing), {
      method: 'POST',
      headers: credentialedRequestHeaders(grant.spend, crossing),
      body: JSON.stringify(credentialedRequestBody(grant, crossing, body)),
      signal: AbortSignal.timeout(proxyFetchBoundMs),
    });

    return await observedCredentialedAnswer(grant, crossing, answer);
  } catch (failure) {
    if (failure instanceof InvalidJsonBodyError) {
      throw failure;
    }

    console.error(unreachableTargetMessage(crossing), failure);

    return null;
  }
}

async function observedCredentialedAnswer(
  grant: Extract<SpendGrant, { verdict: 'resolved' }>,
  crossing: Crossing,
  answer: Response,
): Promise<Response> {
  if (grant.spend.custody !== 'credentialed') return answer;
  if (grant.spend.provider === 'kimi') return observeKimiReplay(crossing, answer);

  if (grant.spend.provider !== 'xai') return answer;

  const decorated = await withXaiRetryAfter(answer);

  return restoreXAIToolResponse(decorated, crossing.xaiNamespaceTools ?? {});
}

function responsesLite(c: Context): boolean {
  return c.req.header('x-openai-internal-codex-responses-lite')?.trim().toLowerCase() === 'true';
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
