import type { QueryClient } from '@tanstack/react-query';
import type { AnyRouter } from '@tanstack/react-router';
import type { ComponentType } from 'react';

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
import { CreateGatewaySheet } from '../../widgets/gateway/create';
import { StatusBar } from '../../widgets/status-bar';
import { AppContent, AppSidebar, AppToolbar } from './-app-shell';

const noDevtools = () => null;

const Devtools: ComponentType<{ router: AnyRouter }> =
  import.meta.env.DEV && import.meta.env.MODE !== 'test'
    ? lazy(async () => import('../devtools').then((module) => ({ default: module.AppDevtools })))
    : noDevtools;

export type RouterAppContext = {
  queryClient: QueryClient;
};

export type RootSearch = {
  create?: true;
  getStarted?: true;
  at?: string;
};

function pressMark(at: unknown): string | undefined {
  return typeof at === 'string' || typeof at === 'number' ? String(at) : undefined;
}

function asked(value: unknown): boolean {
  return value === true || value === 'true';
}

function surfaceRequest(search: Record<string, unknown>): RootSearch {
  const request: RootSearch = {};
  const at = pressMark(search['at']);

  if (asked(search['create'])) {
    request.create = true;
  }

  if (asked(search['getStarted'])) {
    request.getStarted = true;
  }

  if (at !== undefined) {
    request.at = at;
  }

  return request;
}

function withSheet(previous: RootSearch): RootSearch {
  return { ...previous, create: true };
}

function withoutSheet(previous: RootSearch): RootSearch {
  const remaining: RootSearch = {};

  if (previous.getStarted === true) {
    remaining.getStarted = true;
  }

  if (previous.at !== undefined) {
    remaining.at = previous.at;
  }

  return remaining;
}

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

function RootLayout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const { create, getStarted, at } = Route.useSearch();
  const { slug } = useParams({ strict: false });
  const sidebarAway = useSyncExternalStore(subscribeToSidebarVisibility, sidebarHidden);

  useEffect(() => bindEngineStatesToCache(queryClient), [queryClient]);

  return (
    <div className="flex h-full overflow-hidden">
      {!sidebarAway && (
        <AppSidebar
          onNewGateway={() => {
            void navigate({ to: '/', search: withSheet });
          }}
          restoreGetStarted={getStarted === true ? (at ?? 'asked') : undefined}
        />
      )}
      <main className="relative flex flex-1 flex-col overflow-hidden bg-surface-content text-body">
        <AppToolbar slug={slug} />
        <AppContent>
          <Outlet />
        </AppContent>
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
        <Devtools router={router} />
      </Suspense>
    </div>
  );
}

function NotFound() {
  return <p>Not found</p>;
}
