import { queryOptions } from '@tanstack/react-query';

import { unwrapIpcResult } from './ipc-result';

/** What one look at a target account's model list answers: the ids it serves, or why not. */
export type ProviderModelList =
  | { standing: 'listed'; modelIds: readonly string[] }
  | { standing: 'unlisted'; refusal: string };

const NOTHING_ANSWERED = "recompose couldn't read this account's model list.";

/**
 * The answer a look that reached nothing gives.
 *
 * @summary A look that fails is expected life rather than a surprise, so it answers a standing the
 * sheet can read out loud instead of throwing. One sentence stands for every silent look, because
 * the lane behind it folds an unreachable provider, a credential a vendor turned away, and a body
 * that was not a catalog into the same nothing, and none of those is a person's to tell apart.
 */
function unreachableModelList(): ProviderModelList {
  return { standing: 'unlisted', refusal: NOTHING_ANSWERED };
}

async function modelsOf(accountId: string): Promise<ProviderModelList> {
  const listing = unwrapIpcResult(
    await window.recompose['accounts:list-models']({ id: accountId }),
  );

  return listing.standing === 'listed'
    ? { standing: 'listed', modelIds: listing.modelIds }
    : unreachableModelList();
}

/**
 * The models one target account serves, as of this look.
 *
 * @summary Reach for it from the sheet the moment a target is picked. The reading keys on the
 * account, so pointing the look at another account is a fresh question rather than a stale answer.
 * Nothing caches it past unmount and every mount looks again, because a list a provider has since
 * changed must never stand as what the account serves now. Main answering nothing is data, while
 * main refusing outright carries out, so the field says the words main wrote in that one case.
 */
export function providerModelsQueryOptions(accountId: string) {
  return queryOptions({
    queryKey: ['provider-models', accountId],
    queryFn: async () => modelsOf(accountId),
    gcTime: 0,
    refetchOnMount: 'always',
  });
}
