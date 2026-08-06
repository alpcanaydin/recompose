import type { EngineGateway, SpendGrant } from '@recompose/contracts';
import type { Context } from 'hono';

import { proxyFetchBoundMs } from '@recompose/contracts';

import type { ChatCompletionsResponse } from './dialect/chat-completions-wire';
import type { JsonObject, ProxyDialect } from './gateway-wire';
import type { TranslationRefusal } from './refusals';

import { translateRequest, translateResponse, translateStream } from './dialect/dispatcher';
import {
  ingressPayload,
  isJsonObject,
  jsonResponse,
  parsedJson,
  readJsonBody,
  virtualNameOf,
  wantsStream,
} from './gateway-wire';
import {
  emptyConversation,
  missingCredential,
  missingTarget,
  renderRefusal,
  unknownModel,
} from './refusals';
import { chatFramesFrom, sseBodyFrom } from './stream-wire';

export type SpendGrantFor = (slug: string, virtualModel: string) => Promise<SpendGrant>;

type Crossing = {
  dialect: ProxyDialect;
  raw: JsonObject;
  gatewayName: string;
  virtualModel: string;
  providerModel: string;
};

function refusalResponse(dialect: ProxyDialect, refusal: TranslationRefusal): Response {
  const rendered = renderRefusal(dialect, refusal);

  return jsonResponse(rendered.body, rendered.status);
}

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

  const upstream = await fetchLike(chatCompletionsUrl(grant.providerOrigin), {
    method: 'POST',
    headers: spendHeaders(grant.spend),
    body: JSON.stringify(outbound.body),
    signal: AbortSignal.timeout(proxyFetchBoundMs),
  });

  return answerFrom(crossing, upstream);
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

function attributionOf(crossing: Crossing): Record<string, string> {
  return {
    'x-recompose-virtual-model': crossing.virtualModel,
    'x-recompose-target': crossing.providerModel,
  };
}

function upstreamHeaders(upstream: Response, attribution: Record<string, string>): Headers {
  const headers = new Headers(attribution);
  const contentType = upstream.headers.get('content-type');

  if (contentType !== null) {
    headers.set('content-type', contentType);
  }

  return headers;
}

function passedAlong(upstream: Response, attribution: Record<string, string>): Response {
  return new Response(upstream.body, {
    status: upstream.status,
    headers: upstreamHeaders(upstream, attribution),
  });
}

async function answerFrom(crossing: Crossing, upstream: Response): Promise<Response> {
  const attribution = attributionOf(crossing);

  if (!upstream.ok) {
    return passedAlong(upstream, attribution);
  }

  if (upstream.headers.get('content-type')?.includes('text/event-stream') === true) {
    return streamedAnswer(crossing, upstream, attribution);
  }

  return translatedAnswer(crossing, upstream, attribution);
}

function streamedAnswer(
  crossing: Crossing,
  upstream: Response,
  attribution: Record<string, string>,
): Response {
  if (upstream.body === null) {
    return passedAlong(upstream, attribution);
  }

  const crossed = translateStream(
    'chat-completions',
    crossing.dialect,
    chatFramesFrom(upstream.body),
  );

  if ('outcome' in crossed) {
    return passedAlong(upstream, attribution);
  }

  return new Response(sseBodyFrom(crossed.stream), {
    status: upstream.status,
    headers: { ...attribution, 'content-type': 'text/event-stream' },
  });
}

function isChatAnswer(value: JsonObject): value is JsonObject & ChatCompletionsResponse {
  const choices = value['choices'];

  return (
    Array.isArray(choices) &&
    choices.every((choice) => isJsonObject(choice) && isJsonObject(choice['message']))
  );
}

function textAnswer(
  text: string,
  upstream: Response,
  attribution: Record<string, string>,
): Response {
  return new Response(text, {
    status: upstream.status,
    headers: upstreamHeaders(upstream, attribution),
  });
}

async function translatedAnswer(
  crossing: Crossing,
  upstream: Response,
  attribution: Record<string, string>,
): Promise<Response> {
  const text = await upstream.text();
  const parsed = parsedJson(text);

  if (!isJsonObject(parsed) || !isChatAnswer(parsed)) {
    return textAnswer(text, upstream, attribution);
  }

  const crossed = translateResponse('chat-completions', crossing.dialect, parsed);

  if ('value' in crossed) {
    return jsonResponse(crossed.value, upstream.status, attribution);
  }

  return textAnswer(text, upstream, attribution);
}
