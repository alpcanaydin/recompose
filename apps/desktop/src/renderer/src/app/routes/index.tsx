import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: EmptyState,
});

function EmptyState() {
  return <p>Select a gateway or create one to get started.</p>;
}
