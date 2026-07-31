import { createFileRoute } from '@tanstack/react-router';

import { UsagePage } from '../../pages/usage';
import { PageError } from '../../shared/ui';

export const Route = createFileRoute('/usage')({
  component: UsagePage,
  errorComponent: PageError,
});
