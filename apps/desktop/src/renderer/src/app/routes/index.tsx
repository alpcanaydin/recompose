import { createFileRoute } from '@tanstack/react-router';

import { EmptyState } from '../../pages/home';

export const Route = createFileRoute('/')({
  component: EmptyState,
});
