import { createFileRoute } from '@tanstack/react-router';

import {
  SettingsPage,
  gatewayTokenQueryOptions,
  settingsQueryOptions,
  systemQueryOptions,
} from '../../pages/settings';

type SettingsSearch = {
  focus?: 'first-control';
  at?: string;
};

function focusRequest(search: Record<string, unknown>): SettingsSearch {
  if (search['focus'] !== 'first-control') {
    return {};
  }

  const at = search['at'];

  return typeof at === 'string' ? { focus: 'first-control', at } : { focus: 'first-control' };
}

export const Route = createFileRoute('/settings')({
  validateSearch: focusRequest,
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
  const { focus, at } = Route.useSearch();

  return <SettingsPage at={at} focus={focus} />;
}
