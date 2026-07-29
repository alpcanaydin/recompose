import type { QueryClient } from '@tanstack/react-query';

import { Link, Outlet, createRootRouteWithContext } from '@tanstack/react-router';
import { Suspense, lazy, useId } from 'react';

const RouterDevtools =
  import.meta.env.DEV && import.meta.env.MODE !== 'test'
    ? lazy(async () =>
        import('@tanstack/react-router-devtools').then((module) => ({
          default: module.TanStackRouterDevtools,
        })),
      )
    : () => null;

const QueryDevtools =
  import.meta.env.DEV && import.meta.env.MODE !== 'test'
    ? lazy(async () =>
        import('@tanstack/react-query-devtools').then((module) => ({
          default: module.ReactQueryDevtools,
        })),
      )
    : () => null;

export type RouterAppContext = {
  queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  const systemId = useId();

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="app-drag w-60 bg-surface-sidebar px-4 pt-13 pb-4 text-body text-ink-secondary">
        <nav className="app-no-drag flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Link to="/">Gateways</Link>
            <Link to="/providers">Providers</Link>
          </div>
          <div aria-labelledby={systemId} className="flex flex-col gap-2" role="group">
            <h2 className="text-overline text-ink uppercase" id={systemId}>
              System
            </h2>
            <Link to="/settings">Settings</Link>
          </div>
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto bg-surface-content px-6 pt-13 pb-6 text-body">
        <Outlet />
      </main>
      <Suspense>
        <RouterDevtools />
        <QueryDevtools />
      </Suspense>
    </div>
  );
}

function NotFound() {
  return <p>Not found</p>;
}
