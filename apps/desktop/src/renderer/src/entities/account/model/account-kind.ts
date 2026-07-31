import type { AccountsDocument } from '@recompose/contracts';

import { accountKindSchema } from '@recompose/contracts';

/** One of the three ways an account can be held, as the accounts document stores it. */
export type AccountKind = AccountsDocument['accounts'][number]['kind'];

type StoredAccounts = AccountsDocument['accounts'];

const titles: Record<AccountKind, string> = {
  subscription: 'Subscriptions',
  'api-key': 'API Keys',
  aggregator: 'Aggregators',
};

/**
 * Every kind an account can be stored as, in the order they are offered.
 *
 * @summary The contract is the one authority on which kinds exist, so the list reads from the
 * schema rather than repeating it and drifting from it.
 */
export const accountKinds = accountKindSchema.options;

/** The name a kind goes by on screen, rather than the token it is stored under. */
export function accountKindTitle(kind: AccountKind): string {
  return titles[kind];
}

/** The stored accounts held as one kind, which is what a kind's surface lists and counts. */
export function accountsOfKind(accounts: StoredAccounts, kind: AccountKind): StoredAccounts {
  return accounts.filter((account) => account.kind === kind);
}
