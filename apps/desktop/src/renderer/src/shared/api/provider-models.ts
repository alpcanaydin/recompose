import { queryOptions } from '@tanstack/react-query';

/** What one look at a target account's model list answers: the ids it serves, or why not. */
export type ProviderModelList =
  | { standing: 'listed'; modelIds: readonly string[] }
  | { standing: 'unlisted'; refusal: string };

/** The look that answers one account's model list, keyed by the account being asked about. */
export type ProviderModelLook = (accountId: string) => Promise<ProviderModelList>;

const NOTHING_ANSWERED = "recompose couldn't read this account's model list.";

/**
 * The answer a look that reached nothing gives.
 *
 * @summary A look that fails is expected life rather than a surprise, so it answers a standing the
 * sheet can read out loud instead of throwing. One sentence stands for every silent look, so the
 * lane behind the seam and a scenario standing in for it never disagree about what silence says.
 */
export function unreachableModelList(): ProviderModelList {
  return { standing: 'unlisted', refusal: NOTHING_ANSWERED };
}

let answeringLook: ProviderModelLook = async () => Promise.resolve(unreachableModelList());

/**
 * Puts the look that answers a model list behind the query the sheet reads.
 *
 * @summary The seam stands between the sheet and the lane that reaches a provider, so the sheet is
 * written and read once while the lane behind it is wired at the composition root. Until one is
 * put here, every look answers the unreachable standing rather than pretending to serve a list.
 */
export function serveProviderModelLook(look: ProviderModelLook): void {
  answeringLook = look;
}

/**
 * The models one target account serves, as of this look.
 *
 * @summary Reach for it from the sheet the moment a target is picked. The reading keys on the
 * account, so pointing the look at another account is a fresh question rather than a stale answer.
 * Nothing caches it past unmount and every mount looks again, because a list a provider has since
 * changed must never stand as what the account serves now.
 */
export function providerModelsQueryOptions(accountId: string) {
  return queryOptions({
    queryKey: ['provider-models', accountId],
    queryFn: async () => answeringLook(accountId),
    gcTime: 0,
    refetchOnMount: 'always',
  });
}
