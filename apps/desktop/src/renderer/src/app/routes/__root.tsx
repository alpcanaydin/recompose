import type { QueryClient } from '@tanstack/react-query';

import { useQueryClient } from '@tanstack/react-query';
import { Outlet, createRootRouteWithContext, useNavigate, useParams } from '@tanstack/react-router';
import { Suspense, lazy, useEffect } from 'react';

import {
  bindEngineStatesToCache,
  engineStatesQueryOptions,
  gatewaysQueryOptions,
} from '../../shared/api';
import { CreateGatewaySheet } from '../../widgets/gateway/create';
import { StatusBar } from '../../widgets/status-bar';
import { AppSidebar, AppToolbar } from './-app-shell';

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
    ]);
  },
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { create } = Route.useSearch();
  const { slug } = useParams({ strict: false });

  useEffect(() => bindEngineStatesToCache(queryClient), [queryClient]);

  return (
    <div className="flex h-full overflow-hidden">
      <AppSidebar
        onNewGateway={() => {
          void navigate({ to: '.', search: withSheet });
        }}
      />
      <main className="flex flex-1 flex-col overflow-hidden bg-surface-content text-body">
        <AppToolbar slug={slug} />
        <div className="relative flex-1 overflow-y-auto">
          <Outlet />
        </div>
        <StatusBar />
      </main>
      <CreateGatewaySheet
        onOpenChange={(open) => {
          if (!open) {
            void navigate({ to: '.', search: withoutSheet, replace: true });
          }
        }}
        open={create === true}
      />
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
