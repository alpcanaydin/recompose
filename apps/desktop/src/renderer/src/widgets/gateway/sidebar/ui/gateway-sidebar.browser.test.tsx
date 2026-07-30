import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import type { BridgeParameters } from '../../../../shared/testing';

import {
  bindEngineStatesToCache,
  engineStatesQueryOptions,
  gatewaysQueryOptions,
} from '../../../../shared/api';
import { emitEngineStates, gatewaySeed, installFakeBridge } from '../../../../shared/testing';
import { GatewaySidebar } from './gateway-sidebar';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });
const gemini = gatewaySeed({ slug: 'gemini', displayName: 'Gemini', port: 51235 });

async function renderSidebar(parameters: BridgeParameters, onNewGateway = () => {}) {
  installFakeBridge(parameters);

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  await Promise.all([
    queryClient.ensureQueryData(gatewaysQueryOptions),
    queryClient.ensureQueryData(engineStatesQueryOptions),
  ]);

  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>Loading…</p>}>
        <GatewaySidebar onNewGateway={onNewGateway} />
      </Suspense>
    </QueryClientProvider>,
  );

  return { screen, queryClient };
}

test('one gateway running and another still read differently on their rows', async () => {
  const { screen } = await renderSidebar({
    gateways: [codex, gemini],
    engineStates: { codex: { status: 'running' } },
  });

  await expect.element(screen.getByRole('link', { name: 'Codex Running' })).toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'Gemini Stopped' })).toBeVisible();
});

test('a gateway the engine has never reported reads as stopped', async () => {
  const { screen } = await renderSidebar({ gateways: [codex], engineStates: {} });

  await expect.element(screen.getByRole('link', { name: 'Codex Stopped' })).toBeVisible();
});

test('a stored gateway gets a row that reaches its canvas', async () => {
  const { screen } = await renderSidebar({ gateways: [codex] });

  await expect
    .element(screen.getByRole('link', { name: 'Codex Stopped' }))
    .toHaveAttribute('href', '#/gateways/codex');
});

test('the sidebar lists no gateway group before the first gateway exists', async () => {
  const { screen } = await renderSidebar({ gateways: [] });

  await expect
    .element(screen.getByRole('button', { name: 'New Gateway…' }))
    .not.toBeInTheDocument();
  await expect
    .element(screen.getByRole('group', { name: 'Local Gateways' }))
    .not.toBeInTheDocument();
});

test('once a gateway exists the sidebar offers the way to the next one', async () => {
  const onNewGateway = vi.fn<() => void>();
  const { screen } = await renderSidebar({ gateways: [codex] }, onNewGateway);

  await screen.getByRole('button', { name: 'New Gateway…' }).click();

  expect(onNewGateway).toHaveBeenCalledTimes(1);
});

test('a gateway group gathers the rows under its own heading', async () => {
  const { screen } = await renderSidebar({ gateways: [codex] });

  const gateways = screen.getByRole('group', { name: 'Local Gateways' });

  await expect.element(gateways).toBeVisible();
  await expect.element(gateways.getByRole('link', { name: 'Codex Stopped' })).toBeVisible();
});

test('a lifecycle push moves a row to running without a reload', async () => {
  const { screen, queryClient } = await renderSidebar({ gateways: [codex], engineStates: {} });

  const release = bindEngineStatesToCache(queryClient);

  await expect.element(screen.getByRole('link', { name: 'Codex Stopped' })).toBeVisible();

  emitEngineStates({ codex: { status: 'running' } });

  await expect.element(screen.getByRole('link', { name: 'Codex Running' })).toBeVisible();

  release();
});
