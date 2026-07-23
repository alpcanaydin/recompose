import { createFileRoute } from '@tanstack/react-router';

import { ProvidersPage, accountsQueryOptions } from '../../pages/providers';

export const Route = createFileRoute('/providers')({
  loader: ({ context }) => context.queryClient.ensureQueryData(accountsQueryOptions),
  component: ProvidersPage,
});
