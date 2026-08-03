import type { AccountsDocument, CredentialedAccount } from '@recompose/contracts';

import { useSuspenseQuery } from '@tanstack/react-query';

import { accountsQueryOptions } from '../../../../shared/api';
import { CredentialedEmptyState } from '../credentialed-empty-state/credentialed-empty-state';
import { KeyAccountRow } from '../key-account-row/key-account-row';

type CredentialedSurfaceProps = {
  /** The credential kind a sidebar row narrowed the surface to. */
  kind: 'api-key' | 'aggregator';
};

function heldUnder(
  accounts: AccountsDocument['accounts'],
  kind: CredentialedSurfaceProps['kind'],
): readonly CredentialedAccount[] {
  return accounts.filter((account): account is CredentialedAccount => account.kind === kind);
}

/** The key accounts held under one kind, or the state explaining the kind before one exists. */
export function CredentialedSurface({ kind }: CredentialedSurfaceProps) {
  const { data: registry } = useSuspenseQuery(accountsQueryOptions);
  const held = heldUnder(registry.accounts, kind);

  if (held.length === 0) {
    return <CredentialedEmptyState kind={kind} />;
  }

  return (
    <ul className="flex flex-col gap-2">
      {held.map((account) => (
        <KeyAccountRow account={account} key={account.id} />
      ))}
    </ul>
  );
}
