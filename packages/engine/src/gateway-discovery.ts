import type { EngineGateway, EngineVirtualModel } from '@recompose/contracts';

import type { AnthropicRefusal } from './refusals';

import { renderRefusal, unknownModel } from './refusals';

type ListedModel = { id: string; object: 'model'; type: 'model'; display_name: string };

export type ModelListing = {
  object: 'list';
  data: ListedModel[];
  first_id: string | null;
  has_more: boolean;
  last_id: string | null;
};

function listedModelOf(virtualModel: EngineVirtualModel): ListedModel {
  return {
    id: virtualModel.id,
    object: 'model',
    type: 'model',
    display_name: virtualModel.displayName,
  };
}

export function modelListing(virtualModels: readonly EngineVirtualModel[]): ModelListing {
  const data = virtualModels.map(listedModelOf);

  return {
    object: 'list',
    data,
    first_id: data.at(0)?.id ?? null,
    has_more: false,
    last_id: data.at(-1)?.id ?? null,
  };
}

function uncountableTokens(gatewayName: string, model: string): AnthropicRefusal {
  return {
    type: 'error',
    error: {
      type: 'invalid_request_error',
      message: `The gateway "${gatewayName}" serves no token count for "${model}", because its target speaks a dialect without one.`,
    },
  };
}

export type CountTokensAnswer = { status: number; body: unknown };

export function countTokensAnswerFor(gateway: EngineGateway, model: string): CountTokensAnswer {
  const defined = gateway.virtualModels.find((virtualModel) => virtualModel.id === model);

  if (defined === undefined) {
    return renderRefusal('anthropic', unknownModel(model));
  }

  return { status: 400, body: uncountableTokens(gateway.displayName, model) };
}
