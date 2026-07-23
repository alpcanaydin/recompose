import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/providers')({
  component: ProvidersPlaceholder,
});

function ProvidersPlaceholder() {
  return <p>Providers</p>;
}
