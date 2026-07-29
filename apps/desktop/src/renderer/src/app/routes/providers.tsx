import { createFileRoute } from '@tanstack/react-router';

import { ProvidersPage, accountsQueryOptions } from '../../pages/providers';
import { PageError } from '../../shared/ui';

export const Route = createFileRoute('/providers')({
  loader: async ({ context }) => context.queryClient.ensureQueryData(accountsQueryOptions),
  component: ProvidersPage,
  errorComponent: PageError,
});
