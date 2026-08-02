import { useSuspenseQuery } from '@tanstack/react-query';

import { accountsOfKind } from '../../../entities/account';
import { accountsQueryOptions } from '../../../shared/api';
import { AccountList } from './account-list';
import { AddProviderButton } from './add-provider-button';
import { CredentialedEmptyState } from './credentialed-empty-state';

type CredentialedSurfaceProps = {
  /** The credential kind a sidebar row narrowed the surface to. */
  kind: 'api-key' | 'aggregator';
  /** Asks for the catalog, which the page owns because it also holds the drawer. */
  onAddProvider: () => void;
};

/** The key accounts held under one kind, or the state explaining the kind before one exists. */
export function CredentialedSurface({ kind, onAddProvider }: CredentialedSurfaceProps) {
  const { data: registry } = useSuspenseQuery(accountsQueryOptions);
  const accounts = accountsOfKind(registry.accounts, kind);

  if (accounts.length === 0) {
    return <CredentialedEmptyState kind={kind} onAddProvider={onAddProvider} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <AddProviderButton onAddProvider={onAddProvider} />
      <AccountList accounts={accounts} />
    </div>
  );
}
