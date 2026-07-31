import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { HomePage } from '../../pages/home';
import { accountsQueryOptions } from '../../shared/api';
import { PageError } from '../../shared/ui';
import { type RootSearch } from './__root';

function withSheet(previous: RootSearch): RootSearch {
  return { ...previous, create: true };
}

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(accountsQueryOptions);
  },
  component: HomeRoute,
  errorComponent: PageError,
});

function HomeRoute() {
  const navigate = useNavigate();
  const { getStarted, at } = Route.useSearch();
  const { data: registry } = useSuspenseQuery(accountsQueryOptions);

  return (
    <HomePage
      onCreateGateway={() => {
        void navigate({ to: '.', search: withSheet });
      }}
      providerConnected={registry.accounts.length > 0}
      restoreRequest={getStarted === true ? (at ?? 'asked') : undefined}
    />
  );
}
