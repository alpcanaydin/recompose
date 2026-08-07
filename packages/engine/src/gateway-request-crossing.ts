import type { EngineGateway, EngineVirtualModel } from '@recompose/contracts';
import type { Context } from 'hono';

import type { Crossing, ProxyDialect } from './gateway-wire';

import { requestHeaderMap, requestQueryMap } from './gateway-request-metadata';
import { requestSessions, requestsResponsesLite } from './gateway-session';
import { readJsonBody, refusalResponse, virtualNameOf } from './gateway-wire';
import { missingTarget, unknownModel } from './refusals';

type CrossingLookup =
  | { crossing: Crossing; virtualModel: EngineVirtualModel }
  | { response: Response };

export async function gatewayRequestCrossing(
  c: Context,
  dialect: ProxyDialect,
  gateway: EngineGateway,
): Promise<CrossingLookup> {
  const raw = await readJsonBody(c);
  const name = virtualNameOf(raw, dialect);
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
      responsesLite: requestsResponsesLite(c),
      anthropicBeta: c.req.header('anthropic-beta'),
      requestHeaders: requestHeaderMap(c),
      requestQuery: requestQueryMap(c),
    },
  };
}
