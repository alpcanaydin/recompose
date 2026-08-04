import type { AccountsDocument, LocalAccount } from '@recompose/contracts';

import { useSuspenseQuery } from '@tanstack/react-query';

import { accountsQueryOptions } from '../../../../shared/api';
import { LocalRuntimeRow } from '../local-runtime-row/local-runtime-row';
import { LocalRuntimesEmptyState } from '../local-runtimes-empty-state/local-runtimes-empty-state';

function runtimesHeldIn(accounts: AccountsDocument['accounts']): readonly LocalAccount[] {
  return accounts.filter((account): account is LocalAccount => account.kind === 'local');
}

/**
 * The stored local runtimes, or the state explaining the destination before one connects.
 *
 * @summary The list suspends on the registry and the standings do not: every row stands at once
 * with its look still out and settles on its own, so a slow loopback answer never blanks the page.
 */
export function LocalRuntimesSurface() {
  const { data: registry } = useSuspenseQuery(accountsQueryOptions);
  const held = runtimesHeldIn(registry.accounts);

  if (held.length === 0) {
    return <LocalRuntimesEmptyState />;
  }

  return (
    <ul className="flex flex-col gap-2">
      {held.map((account) => (
        <LocalRuntimeRow account={account} key={account.id} />
      ))}
    </ul>
  );
}
