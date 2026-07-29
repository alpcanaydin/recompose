import { createFileRoute } from '@tanstack/react-router';

import {
  SettingsPage,
  gatewayTokenQueryOptions,
  settingsQueryOptions,
  systemQueryOptions,
} from '../../pages/settings';

type SettingsSearch = {
  focus?: 'first-control';
};

export const Route = createFileRoute('/settings')({
  validateSearch: (search: Record<string, unknown>): SettingsSearch =>
    search['focus'] === 'first-control' ? { focus: 'first-control' } : {},
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(settingsQueryOptions),
      context.queryClient.ensureQueryData(systemQueryOptions),
      context.queryClient.ensureQueryData(gatewayTokenQueryOptions),
    ]);
  },
  component: SettingsRoute,
});

function SettingsRoute() {
  const { focus } = Route.useSearch();

  return <SettingsPage focus={focus} />;
}
