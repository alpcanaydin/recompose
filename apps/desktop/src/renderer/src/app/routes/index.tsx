import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';

import { HomePage } from '../../pages/home';
import { gatewaysQueryOptions } from '../../shared/api';
import { rememberedGateway } from '../../shared/lib';
import { PageError } from '../../shared/ui';
import { withSheet } from './-surface-request';

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context, search }) => {
    const gateways = await context.queryClient.ensureQueryData(gatewaysQueryOptions);
    const slug = rememberedGateway(gateways.map((gateway) => gateway.slug));

    if (slug !== undefined) {
      throw redirect({ to: '/gateways/$slug', params: { slug }, search });
    }
  },
  component: HomeRoute,
  errorComponent: PageError,
});

function HomeRoute() {
  const navigate = useNavigate();

  return (
    <HomePage
      onCreateGateway={() => {
        void navigate({ to: '.', search: withSheet });
      }}
    />
  );
}
