import { accountKindSchema } from '@recompose/contracts';
import { createFileRoute } from '@tanstack/react-router';

import type { AccountKind } from '../../entities/account';

import { ProvidersPage } from '../../pages/providers';
import { accountsQueryOptions } from '../../shared/api';
import { PageError } from '../../shared/ui';

type ProvidersSearch = {
  kind?: AccountKind | undefined;
};

function narrowedKind(search: Record<string, unknown>): ProvidersSearch {
  const asked = accountKindSchema.safeParse(search['kind']);

  return { kind: asked.success ? asked.data : undefined };
}

export const Route = createFileRoute('/providers')({
  validateSearch: narrowedKind,
  loader: async ({ context }) => context.queryClient.ensureQueryData(accountsQueryOptions),
  component: ProvidersRoute,
  errorComponent: PageError,
});

function ProvidersRoute() {
  const { kind } = Route.useSearch();

  return <ProvidersPage kind={kind} />;
}
