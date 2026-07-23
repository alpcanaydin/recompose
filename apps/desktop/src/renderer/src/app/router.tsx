import type { QueryClient } from '@tanstack/react-query';

import { createHashHistory, createRouter, type RouterHistory } from '@tanstack/react-router';

import { routeTree } from './routeTree.gen';

export type AppRouterOptions = {
  queryClient: QueryClient;
  history?: RouterHistory;
};

export function createAppRouter(options: AppRouterOptions) {
  const history = options.history ?? (import.meta.env.PROD ? createHashHistory() : undefined);

  return createRouter({
    routeTree,
    context: { queryClient: options.queryClient },
    ...(history === undefined ? {} : { history }),
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
