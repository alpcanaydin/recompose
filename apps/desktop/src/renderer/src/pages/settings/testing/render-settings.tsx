import type { SystemState } from '@recompose/contracts';
import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { render } from 'vitest-browser-react';

import type { BridgeParameters } from '../../../shared/testing';

import { installFakeBridge } from '../../../shared/testing';

const observed: SystemState = {
  fileBrowser: 'finder',
  loginItem: 'available',
  loginItemEnabled: false,
  menuBarVisible: false,
  configFolder: '/Users/someone/Library/Application Support/recompose',
};

/**
 * Bridge parameters that make the app report the system state a case needs.
 *
 * @summary Reach for it in any settings spec whose component reads `system:get`.
 */
export function reportingSystem(state: Partial<SystemState> = {}): BridgeParameters {
  return {
    overrides: {
      'system:get': async () =>
        Promise.resolve({ ok: true as const, value: { ...observed, ...state } }),
    },
  };
}

/**
 * Mounts a settings surface against the fake bridge, inside the providers it expects.
 *
 * @summary Reach for it instead of rebuilding the query client and suspense boundary per spec.
 */
export async function renderAgainstBridge(surface: ReactNode, parameters: BridgeParameters = {}) {
  installFakeBridge(parameters);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>{surface}</Suspense>
    </QueryClientProvider>,
  );
}
