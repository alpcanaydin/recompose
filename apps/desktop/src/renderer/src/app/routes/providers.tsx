import { createFileRoute } from '@tanstack/react-router';

import type { AccountKind } from '../../entities/account';

import { offeredAccountKind } from '../../entities/account';
import { ProvidersPage } from '../../pages/providers';
import {
  accountsQueryOptions,
  subscriptionToolsQueryOptions,
  subscriptionsQueryOptions,
} from '../../shared/api';
import { PageError } from '../../shared/ui';

type ProvidersSearch = {
  kind: AccountKind;
};

function narrowedKind(search: Record<string, unknown>): ProvidersSearch {
  return { kind: offeredAccountKind(search['kind']) ?? 'subscription' };
}

export const Route = createFileRoute('/providers')({
  validateSearch: narrowedKind,
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(accountsQueryOptions),
      context.queryClient.ensureQueryData(subscriptionsQueryOptions),
      context.queryClient.ensureQueryData(subscriptionToolsQueryOptions),
    ]);
  },
  component: ProvidersRoute,
  errorComponent: PageError,
});

function ProvidersRoute() {
  const { kind } = Route.useSearch();

  return <ProvidersPage kind={kind} />;
}
