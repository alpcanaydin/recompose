import { Link, Outlet, createRootRoute } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  return (
    <div className="flex h-full">
      <aside className="app-drag w-60 bg-surface-sidebar px-4 pt-13 pb-4 text-body text-ink-secondary">
        <nav className="flex flex-col gap-2">
          <Link to="/">Gateways</Link>
          <Link to="/providers">Providers</Link>
        </nav>
      </aside>
      <main className="flex-1 bg-surface-content px-6 pt-13 pb-6 text-body">
        <Outlet />
      </main>
    </div>
  );
}

function NotFound() {
  return <p>Not found</p>;
}
