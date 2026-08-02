import type { Decorator } from '@storybook/react-vite';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterContextProvider, createMemoryHistory } from '@tanstack/react-router';
import { Suspense, useMemo } from 'react';

import type { BridgeParameters } from '../src/renderer/src/shared/testing';

import { createAppRouter } from '../src/renderer/src/app/router';
import { installFakeBridge } from '../src/renderer/src/shared/testing';

export const withRecomposeBridge: Decorator = (Story, context) => {
  const bridgeParameter = context.parameters['bridge'] as BridgeParameters | undefined;
  const routeParameter = context.parameters['route'] as string | undefined;

  const surroundings = useMemo(() => {
    installFakeBridge(bridgeParameter ?? {});

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const router = createAppRouter({
      queryClient,
      history: createMemoryHistory({ initialEntries: [routeParameter ?? '/'] }),
    });

    return { queryClient, router };
  }, [bridgeParameter, routeParameter]);

  return (
    <Suspense fallback={null}>
      <RouterContextProvider router={surroundings.router}>
        <QueryClientProvider client={surroundings.queryClient}>
          <Story />
        </QueryClientProvider>
      </RouterContextProvider>
    </Suspense>
  );
};
