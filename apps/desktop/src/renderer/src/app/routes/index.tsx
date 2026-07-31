import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';

import { HomePage } from '../../pages/home';
import { accountsQueryOptions, gatewaysQueryOptions } from '../../shared/api';
import { rememberedGateway } from '../../shared/lib';
import { PageError } from '../../shared/ui';
import { type RootSearch } from './__root';

function withSheet(previous: RootSearch): RootSearch {
  return { ...previous, create: true };
}

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context, search }) => {
    const gateways = await context.queryClient.ensureQueryData(gatewaysQueryOptions);
    const slug = rememberedGateway(gateways.map((gateway) => gateway.slug));

    if (slug !== undefined) {
      throw redirect({ to: '/gateways/$slug', params: { slug }, search });
    }
  },
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
