import type { AccountsDocument, RecomposeIpc } from '@recompose/contracts';
import type { Decorator } from '@storybook/react-vite';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';

const emptyDocument: AccountsDocument = { schemaVersion: 1, accounts: [] };

type BridgeParameters = {
  accounts?: AccountsDocument;
  overrides?: Partial<RecomposeIpc>;
};

function installBridge(parameters: BridgeParameters): void {
  let registry = parameters.accounts ?? emptyDocument;

  window.recompose = {
    'gateways:list': async () => Promise.resolve({ ok: true, value: [] }),
    'gateways:save': async () => Promise.resolve({ ok: true, value: [] }),
    'settings:get': async () =>
      Promise.resolve({
        ok: true,
        value: { schemaVersion: 1, theme: 'system', enginePort: 8397 },
      }),
    'settings:save': async (settings) => Promise.resolve({ ok: true, value: settings }),
    'accounts:list': async () => Promise.resolve({ ok: true, value: registry }),
    'accounts:connect': async (request) => {
      const id = `a${registry.accounts.length + 1}`;

      registry = {
        ...registry,
        accounts: [
          ...registry.accounts,
          {
            id,
            provider: request.provider,
            kind: request.kind,
            label: request.label,
            credentialRef: `c-${id}`,
          },
        ],
      };

      return Promise.resolve({ ok: true, value: registry });
    },
    'accounts:remove': async (request) => {
      registry = {
        ...registry,
        accounts: registry.accounts.filter((row) => row.id !== request.id),
      };

      return Promise.resolve({ ok: true, value: registry });
    },
    ...parameters.overrides,
  };
}

export const withRecomposeBridge: Decorator = (Story, context) => {
  const parameters = (context.parameters['bridge'] ?? {}) as BridgeParameters;

  installBridge(parameters);

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return (
    <Suspense fallback={null}>
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    </Suspense>
  );
};
