import type { Decorator } from '@storybook/react-vite';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useMemo } from 'react';

import type { BridgeParameters } from '../src/renderer/src/shared/testing';

import { installFakeBridge } from '../src/renderer/src/shared/testing';

export const withRecomposeBridge: Decorator = (Story, context) => {
  const bridgeParameter = context.parameters['bridge'] as BridgeParameters | undefined;

  const queryClient = useMemo(() => {
    installFakeBridge(bridgeParameter ?? {});

    return new QueryClient({ defaultOptions: { queries: { retry: false } } });
  }, [bridgeParameter]);

  return (
    <Suspense fallback={null}>
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    </Suspense>
  );
};
