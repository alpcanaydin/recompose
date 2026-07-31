import { useSuspenseQuery } from '@tanstack/react-query';

import { type AccountKind, accountKindTitle, accountsOfKind } from '../../../entities/account';
import { accountsQueryOptions } from '../../../shared/api';
import { AccountList } from './account-list';
import { ConnectAccountForm } from './connect-account-form';

type ProvidersPageProps = {
  /** The kind a sidebar row narrowed the surface to, absent when every account is listed. */
  kind?: AccountKind | undefined;
};

/**
 * The connected accounts of one kind, or of every kind, over the form that connects another.
 *
 * @summary Reach for it from the providers route. The kind rides in the search rather than in
 * the path, so the surface that holds every account stays a route a person can return to.
 */
export function ProvidersPage({ kind }: ProvidersPageProps) {
  const { data: registry } = useSuspenseQuery(accountsQueryOptions);
  const listed = kind === undefined ? registry.accounts : accountsOfKind(registry.accounts, kind);

  return (
    <section className="mx-auto flex w-full max-w-column flex-col gap-5 px-6 pt-page-top pb-6">
      <h1 className="text-title text-ink">
        {kind === undefined ? 'Accounts' : accountKindTitle(kind)}
      </h1>
      <AccountList accounts={listed} />
      <ConnectAccountForm />
    </section>
  );
}
