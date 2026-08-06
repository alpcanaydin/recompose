import type { EngineGateway, SpendGrant } from '@recompose/contracts';
import type { Context } from 'hono';

import { proxyFetchBoundMs } from '@recompose/contracts';

import type { Crossing, JsonObject, ProxyDialect } from './gateway-wire';
import type { TranslationRefusal } from './refusals';

import { translateRequest } from './dialect/dispatcher';
import { answerFrom, unreachableTargetAnswer, unreachableTargetMessage } from './gateway-answers';
import {
  ingressPayload,
  readJsonBody,
  refusalResponse,
  virtualNameOf,
  wantsStream,
} from './gateway-wire';
import { emptyConversation, missingCredential, missingTarget, unknownModel } from './refusals';

export type SpendGrantFor = (slug: string, virtualModel: string) => Promise<SpendGrant>;

export async function proxyModelRequest(
  c: Context,
  dialect: ProxyDialect,
  gateway: EngineGateway,
  spendGrantFor: SpendGrantFor,
  fetchLike: typeof fetch,
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
  };

  return forwardGranted(crossing, await spendGrantFor(gateway.slug, virtualModel.id), fetchLike);
}

async function forwardGranted(
  crossing: Crossing,
  grant: SpendGrant,
  fetchLike: typeof fetch,
): Promise<Response> {
  if (grant.verdict === 'missing-target') {
    return refusalResponse(
      crossing.dialect,
      missingTarget(crossing.gatewayName, crossing.virtualModel),
    );
  }

  if (grant.verdict === 'missing-credential') {
    return refusalResponse(
      crossing.dialect,
      missingCredential(crossing.gatewayName, crossing.virtualModel),
    );
  }

  const outbound = outboundBodyFor(crossing);

  if ('refusal' in outbound) {
    return refusalResponse(crossing.dialect, outbound.refusal);
  }

  const upstream = await reachedUpstream(crossing, grant, outbound.body, fetchLike);

  if (upstream === null) {
    return unreachableTargetAnswer(crossing);
  }

  return answerFrom(crossing, upstream);
}

async function reachedUpstream(
  crossing: Crossing,
  grant: Extract<SpendGrant, { verdict: 'resolved' }>,
  body: JsonObject,
  fetchLike: typeof fetch,
): Promise<Response | null> {
  try {
    return await fetchLike(chatCompletionsUrl(grant.providerOrigin), {
      method: 'POST',
      headers: spendHeaders(grant.spend),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(proxyFetchBoundMs),
    });
  } catch (failure) {
    console.error(unreachableTargetMessage(crossing), failure);

    return null;
  }
}

type OutboundBody = { body: JsonObject } | { refusal: TranslationRefusal };

function outboundBodyFor(crossing: Crossing): OutboundBody {
  const payload = ingressPayload(crossing.dialect, crossing.raw);

  if (payload === null) {
    return { refusal: emptyConversation() };
  }

  const crossed = translateRequest(crossing.dialect, 'chat-completions', payload);

  if ('outcome' in crossed) {
    return { body: { ...crossing.raw, model: crossing.providerModel } };
  }

  if ('refusal' in crossed) {
    return { refusal: crossed.refusal };
  }

  return { body: { ...crossed.value, model: crossing.providerModel, ...streamAsk(crossing.raw) } };
}

function streamAsk(raw: JsonObject): { stream?: boolean } {
  return wantsStream(raw) ? { stream: true } : {};
}

function chatCompletionsUrl(providerOrigin: string): string {
  return `${providerOrigin.replace(/\/+$/u, '')}/v1/chat/completions`;
}

type GrantedSpend = Extract<SpendGrant, { verdict: 'resolved' }>['spend'];

function spendHeaders(spend: GrantedSpend): Record<string, string> {
  const shared = { 'content-type': 'application/json' };

  return spend.custody === 'credentialed'
    ? { ...shared, authorization: `Bearer ${spend.credential}` }
    : shared;
}
