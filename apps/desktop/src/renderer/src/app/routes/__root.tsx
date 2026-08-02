import type { QueryClient } from '@tanstack/react-query';
import type { AnyRouter } from '@tanstack/react-router';
import type { ComponentType, ReactNode } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import {
  Outlet,
  createRootRouteWithContext,
  useNavigate,
  useParams,
  useRouter,
} from '@tanstack/react-router';
import { Suspense, lazy, useEffect, useSyncExternalStore } from 'react';

import {
  accountsQueryOptions,
  bindEngineStatesToCache,
  engineStatesQueryOptions,
  gatewaysQueryOptions,
} from '../../shared/api';
import { sidebarHidden, subscribeToSidebarVisibility } from '../../shared/lib';
import { SidebarEdge, SidebarToggle } from '../../shared/ui';
import { CreateGatewaySheet } from '../../widgets/gateway/create';
import { StatusBar } from '../../widgets/status-bar';
import { AppSidebar } from './-app-sidebar';
import { AppToolbar } from './-app-toolbar';
import { NotFound } from './-not-found';
import { surfaceRequest, withSheet, withoutSheet } from './-surface-request';

const noDevtools = () => null;

const Devtools: ComponentType<{ queryClient: QueryClient; router: AnyRouter }> =
  import.meta.env.DEV && import.meta.env.MODE !== 'test'
    ? lazy(async () => import('../devtools').then((module) => ({ default: module.AppDevtools })))
    : noDevtools;

export type RouterAppContext = {
  queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterAppContext>()({
  validateSearch: surfaceRequest,
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(gatewaysQueryOptions),
      context.queryClient.ensureQueryData(engineStatesQueryOptions),
      context.queryClient.ensureQueryData(accountsQueryOptions),
    ]);
  },
  component: RootLayout,
  notFoundComponent: NotFound,
});

/** What the sidebar's band carries, which is nothing while a gateway's toolbar holds the control. */
function bandFor(slug: string | undefined): ReactNode {
  return slug === undefined ? <SidebarToggle where="chrome" /> : null;
}

function RootLayout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const { create, getStarted, at } = Route.useSearch();
  const { slug } = useParams({ strict: false });
  const sidebarAway = useSyncExternalStore(subscribeToSidebarVisibility, sidebarHidden);

  useEffect(() => bindEngineStatesToCache(queryClient), [queryClient]);

  useEffect(() => {
    void window.recompose['system:window-band'](
      sidebarAway && slug !== undefined ? 'toolbar' : 'sidebar',
    );
  }, [sidebarAway, slug]);

  return (
    <div className="flex h-full overflow-hidden">
      <AppSidebar
        away={sidebarAway}
        band={bandFor(slug)}
        onNewGateway={() => {
          void navigate({ to: '/', search: withSheet });
        }}
        restoreGetStarted={getStarted === true ? (at ?? 'asked') : undefined}
      />
      <SidebarEdge />
      <main className="relative flex flex-1 flex-col overflow-hidden bg-surface-content text-body">
        <AppToolbar slug={slug} />
        <div className="relative flex-1 overflow-y-auto">
          <Outlet />
        </div>
        {slug !== undefined && <StatusBar />}
      </main>
      <CreateGatewaySheet
        onCreated={(slug) => {
          void navigate({ to: '/gateways/$slug', params: { slug }, search: {} });
        }}
        onOpenChange={(open) => {
          if (!open) {
            void navigate({ to: '.', search: withoutSheet, replace: true });
          }
        }}
        open={create === true}
      />
      <Suspense>
        <Devtools queryClient={queryClient} router={router} />
      </Suspense>
    </div>
  );
}
