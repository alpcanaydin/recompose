import { createFileRoute } from '@tanstack/react-router';

import { ProvidersPage } from '../../pages/providers';

export const Route = createFileRoute('/providers')({
  component: ProvidersPage,
});
