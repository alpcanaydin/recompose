import { useSuspenseQuery } from '@tanstack/react-query';

import { accountsOfKind } from '../../../entities/account';
import { accountsQueryOptions } from '../../../shared/api';
import { AccountList } from './account-list';
import { CredentialedEmptyState } from './credentialed-empty-state';

type CredentialedSurfaceProps = {
  /** The credential kind a sidebar row narrowed the surface to. */
  kind: 'api-key' | 'aggregator';
};

/** The key accounts held under one kind, or the state explaining the kind before one exists. */
export function CredentialedSurface({ kind }: CredentialedSurfaceProps) {
  const { data: registry } = useSuspenseQuery(accountsQueryOptions);
  const accounts = accountsOfKind(registry.accounts, kind);

  if (accounts.length === 0) {
    return <CredentialedEmptyState kind={kind} />;
  }

  return <AccountList accounts={accounts} />;
}
