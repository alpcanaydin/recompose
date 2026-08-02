import type { AccountKind, AccountsDocument } from '@recompose/contracts';

import { accountKindSchema } from '@recompose/contracts';

export type { AccountKind };

type StoredAccounts = AccountsDocument['accounts'];

const titles: Record<AccountKind, string> = {
  subscription: 'Subscriptions',
  'api-key': 'API Keys',
  aggregator: 'Aggregators',
  local: 'Local Runtimes',
};

/**
 * Every kind an account can be held as, in the order they are offered.
 *
 * @summary The contract is the one authority on which kinds exist, so the list reads from the
 * schema rather than repeating it and drifting from it. `local` browses to a destination that
 * holds nothing yet, because the document refuses to store a local row.
 */
export const accountKinds: readonly AccountKind[] = accountKindSchema.options;

/** The kind a search parameter asks for, or nothing when it names no kind on offer. */
export function offeredAccountKind(asked: unknown): AccountKind | undefined {
  return accountKinds.find((kind) => kind === asked);
}

/** The name a kind goes by on screen, rather than the token it is stored under. */
export function accountKindTitle(kind: AccountKind): string {
  return titles[kind];
}

/** The stored accounts held as one kind, which is what a kind's surface lists and counts. */
export function accountsOfKind(accounts: StoredAccounts, kind: AccountKind): StoredAccounts {
  return accounts.filter((account) => account.kind === kind);
}
