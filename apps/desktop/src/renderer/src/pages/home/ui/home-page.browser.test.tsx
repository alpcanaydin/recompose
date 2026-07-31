import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import type { BridgeParameters } from '../../../shared/testing';

import { engineStatesQueryOptions, gatewaysQueryOptions } from '../../../shared/api';
import { gatewaySeed, installFakeBridge } from '../../../shared/testing';
import { HomePage } from './home-page';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });

const noop = () => {};

const bodyCopy =
  'A gateway is one local address that routes requests across your AI accounts. Everything stays on this machine.';

async function renderHome(parameters: BridgeParameters, onCreateGateway: () => void = noop) {
  installFakeBridge(parameters);

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  await Promise.all([
    queryClient.ensureQueryData(gatewaysQueryOptions),
    queryClient.ensureQueryData(engineStatesQueryOptions),
  ]);

  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>Loading…</p>}>
        <HomePage onCreateGateway={onCreateGateway} />
      </Suspense>
    </QueryClientProvider>,
  );
}

test('a fresh install invites the first gateway rather than showing an empty surface', async () => {
  const screen = await renderHome({ gateways: [] });

  await expect
    .element(screen.getByRole('heading', { name: 'Create your first gateway', level: 1 }))
    .toBeVisible();
  await expect.element(screen.getByText(bodyCopy)).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Create Gateway' })).toBeVisible();
});

test('the call to action asks for the creation sheet', async () => {
  const onCreateGateway = vi.fn<() => void>();
  const screen = await renderHome({ gateways: [] }, onCreateGateway);

  await screen.getByRole('button', { name: 'Create Gateway' }).click();

  expect(onCreateGateway).toHaveBeenCalledTimes(1);
});

test('the invitation leaves once a gateway exists', async () => {
  const screen = await renderHome({ gateways: [codex] });

  await expect
    .element(screen.getByRole('heading', { name: 'Create your first gateway' }))
    .not.toBeInTheDocument();
});
