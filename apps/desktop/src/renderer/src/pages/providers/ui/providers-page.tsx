import { useSuspenseQuery } from '@tanstack/react-query';

import { accountsQueryOptions } from '../api/accounts';
import { AccountList } from './account-list';
import { ConnectAccountForm } from './connect-account-form';

/** The providers screen listing connected accounts and the connect form. */
export function ProvidersPage() {
  const { data } = useSuspenseQuery(accountsQueryOptions);

  return (
    <section className="mx-auto flex w-full max-w-column flex-col gap-5">
      <h1 className="text-title text-ink">Providers</h1>
      <AccountList accounts={data.accounts} />
      <ConnectAccountForm />
    </section>
  );
}
