import type { RequestOf } from './dialect/dispatcher';
import type { Crossing, JsonObject, ProviderDialect, ProxyDialect } from './gateway-wire';
import type { TranslationRefusal } from './refusals';

import { translateRequest } from './dialect/dispatcher';
import { translateRequestToGemini } from './dialect/gemini-bridge';
import { ingressPayload, streamAsk } from './gateway-wire';
import { applySummaryFromSource } from './provider/summary-policy';
import { emptyConversation } from './refusals';

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
  preserveIncompatibleReasoning: boolean,
) {
  return upstreamDialect === 'gemini'
    ? translateRequestToGemini(
        crossing.dialect,
        payload,
        (names) => {
          crossing.geminiToolNames = names;
        },
        { preserveIncompatibleReasoning },
      )
    : translateRequest(crossing.dialect, upstreamDialect, payload);
}

function translatedOutbound(
  crossing: Crossing,
  upstreamDialect: ProviderDialect,
  payload: RequestOf[ProxyDialect],
  preserveIncompatibleReasoning: boolean,
): OutboundBody {
  const crossed = crossedRequest(crossing, upstreamDialect, payload, preserveIncompatibleReasoning);

  if ('outcome' in crossed) return { body: passthroughBody(crossing) };
  if ('refusal' in crossed) return { refusal: crossed.refusal };

  if (upstreamDialect === 'gemini') {
    crossing.geminiNativeWebSearch = hasNativeGoogleSearch(crossed.value);
  }

  return {
    body: { ...crossed.value, model: crossing.providerModel, ...streamAsk(crossing.raw) },
  };
}

function hasNativeGoogleSearch(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || !('tools' in value)) return false;

  const tools = value.tools;

  return Array.isArray(tools) && tools.some(isGoogleSearchTool);
}

function isGoogleSearchTool(tool: unknown): boolean {
  return typeof tool === 'object' && tool !== null && 'googleSearch' in tool;
}

export function outboundBodyFor(
  crossing: Crossing,
  upstreamDialect: ProviderDialect,
  preserveIncompatibleReasoning = false,
): OutboundBody {
  const raw = rawResponsesBody(crossing, upstreamDialect);

  if (raw !== null) return { body: summaryBody(crossing, upstreamDialect, raw) };

  const payload = ingressPayload(crossing.dialect, crossing.raw);

  const outbound =
    payload === null
      ? { refusal: emptyConversation() }
      : translatedOutbound(crossing, upstreamDialect, payload, preserveIncompatibleReasoning);

  return 'body' in outbound
    ? { body: summaryBody(crossing, upstreamDialect, outbound.body) }
    : outbound;
}

function summaryBody(
  crossing: Crossing,
  upstreamDialect: ProviderDialect,
  body: JsonObject,
): JsonObject {
  return applySummaryFromSource(body, crossing.raw, crossing.dialect, upstreamDialect, {
    model: crossing.providerModel,
  }).body;
}

function passthroughBody(crossing: Crossing): JsonObject {
  if (crossing.dialect !== 'interactions' || typeof crossing.raw['agent'] !== 'string') {
    return { ...crossing.raw, model: crossing.providerModel };
  }

  const { agent: _agent, model: _model, ...body } = crossing.raw;

  return { ...body, agent: crossing.providerModel };
}
