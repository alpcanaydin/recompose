import { createFileRoute } from '@tanstack/react-router';

import {
  SettingsPage,
  gatewayTokenQueryOptions,
  settingsQueryOptions,
  systemQueryOptions,
} from '../../pages/settings';

export const Route = createFileRoute('/settings')({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(settingsQueryOptions),
      context.queryClient.ensureQueryData(systemQueryOptions),
      context.queryClient.ensureQueryData(gatewayTokenQueryOptions),
    ]);
  },
  component: SettingsPage,
});
