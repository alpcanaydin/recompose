import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { render } from 'vitest-browser-react';

import type { BridgeParameters } from '../../shared/testing';

import { installFakeBridge } from '../../shared/testing';
import { createQueryClient } from '../query-client';
import { createAppRouter } from '../router';

/**
 * Mounts the whole app at a path, against a bridge seeded for the case.
 *
 * @summary Reach for it in any spec about the shell or the routes, so a case names the path it
 * arrives at rather than rebuilding the router, the history, and the query client.
 */
export async function renderAt(path: string, parameters: BridgeParameters = {}) {
  installFakeBridge(parameters);

  const queryClient = createQueryClient();
  const router = createAppRouter({
    queryClient,
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
