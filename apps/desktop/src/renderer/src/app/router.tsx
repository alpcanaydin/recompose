import { createHashHistory, createRouter, type RouterHistory } from '@tanstack/react-router';

import { routeTree } from './routeTree.gen';

export function createAppRouter(history?: RouterHistory) {
  const resolvedHistory = history ?? (import.meta.env.PROD ? createHashHistory() : undefined);

  return createRouter({
    routeTree,
    ...(resolvedHistory === undefined ? {} : { history: resolvedHistory }),
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
