import type { ProviderModelList, ProviderModelLook } from '../api';

import { unreachableModelList } from '../api';

/** The model ids each account answers a look with, keyed by the account's stored id. */
export type SeededModelLists = Record<string, readonly string[]>;

export const noModelLists: SeededModelLists = {};

function answerFor(seeded: SeededModelLists, accountId: string): ProviderModelList {
  const listed = seeded[accountId];

  return listed === undefined ? unreachableModelList() : { standing: 'listed', modelIds: listed };
}

/**
 * The model-list half of the fake bridge, standing in for the lane that reaches a provider.
 *
 * @summary A scenario names the accounts whose lists are readable this run, so an account it never
 * named answers the same unreachable standing a silent provider does. That way the refusal a person
 * reads in the sheet is the one the real lane hands over rather than one the fake invented.
 */
export function modelListLook(seeded: SeededModelLists): ProviderModelLook {
  return async (accountId) => Promise.resolve(answerFor(seeded, accountId));
}
