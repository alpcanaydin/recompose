import { createFileRoute } from '@tanstack/react-router';

import { SettingsPage, settingsQueryOptions, systemQueryOptions } from '../../pages/settings';
import { PageError } from '../../shared/ui';

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
    ]);
  },
  component: SettingsRoute,
  errorComponent: PageError,
});

function SettingsRoute() {
  const { focus, at } = Route.useSearch();

  return <SettingsPage at={at} focus={focus} />;
}
