import type { EngineVirtualModel } from '@recompose/contracts';

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
