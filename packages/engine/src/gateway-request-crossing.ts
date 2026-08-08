import type { EngineGateway, EngineVirtualModel } from '@recompose/contracts';
import type { Context } from 'hono';

import type { Crossing, ProxyDialect } from './gateway-wire';

import { responsesToolRefs } from './dialect/responses-extended-tools';
import { requestHeaderMap, requestQueryMap } from './gateway-request-metadata';
import {
  requestCallerFingerprint,
  requestSessions,
  requestsResponsesLite,
} from './gateway-session';
import { ingressPayload, readJsonBody, refusalResponse, virtualNameOf } from './gateway-wire';
import { missingTarget, unknownModel } from './refusals';

type CrossingLookup =
  | { crossing: Crossing; virtualModel: EngineVirtualModel }
  | { response: Response };

function crossingBody(
  body: Record<string, unknown>,
  modelOverride: string | undefined,
  streamOverride: boolean | undefined,
): Record<string, unknown> {
  return {
    ...body,
    ...(modelOverride === undefined ? {} : { model: modelOverride }),
    ...(streamOverride === true ? { stream: true } : {}),
  };
}

export async function gatewayRequestCrossing(
  c: Context,
  dialect: ProxyDialect,
  gateway: EngineGateway,
  modelOverride?: string,
  streamOverride?: boolean,
): Promise<CrossingLookup> {
  const body = await readJsonBody(c);
  const raw = crossingBody(body, modelOverride, streamOverride);
  const name = modelOverride ?? virtualNameOf(raw, dialect);
  const virtualModel = gateway.virtualModels.find((candidate) => candidate.id === name);

  if (virtualModel === undefined) {
    return { response: refusalResponse(dialect, unknownModel(name)) };
  }

  if (virtualModel.target.standing === 'removed') {
    return { response: refusalResponse(dialect, missingTarget(gateway.displayName, name)) };
  }

  return {
    virtualModel,
    crossing: {
      dialect,
      raw,
      gatewayName: gateway.displayName,
      virtualModel: virtualModel.id,
      providerModel: virtualModel.target.providerModel,
      ...requestSessions(c, raw),
      callerFingerprint: requestCallerFingerprint(c),
      responsesLite: requestsResponsesLite(c),
      anthropicBeta: c.req.header('anthropic-beta'),
      requestHeaders: requestHeaderMap(c),
      requestQuery: requestQueryMap(c),
      ...responsesRefs(dialect, raw),
    },
  };
}

function responsesRefs(
  dialect: ProxyDialect,
  raw: Record<string, unknown>,
): Pick<Crossing, 'responsesToolRefs'> | object {
  if (dialect !== 'responses') return {};

  const request = ingressPayload('responses', raw);

  return request === null ? {} : { responsesToolRefs: responsesToolRefs(request) };
}
