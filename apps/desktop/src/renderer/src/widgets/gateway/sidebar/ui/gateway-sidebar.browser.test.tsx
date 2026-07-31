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

test('before the first gateway exists the group still offers the way to make one', async () => {
  const { screen } = await renderSidebar({ gateways: [] });

  const gateways = screen.getByRole('group', { name: 'Local Gateways' });

  await expect.element(gateways).toBeVisible();
  await expect.element(gateways.getByRole('button', { name: 'New Gateway…' })).toBeVisible();
});

test('with nothing listed the way to the next gateway spells itself out as a row', async () => {
  const { screen } = await renderSidebar({ gateways: [] });

  await expect
    .element(screen.getByRole('button', { name: 'New Gateway…' }))
    .toHaveTextContent('New Gateway…');
});

test('once a gateway is listed the way to the next one keeps its name as a mark', async () => {
  const { screen } = await renderSidebar({ gateways: [codex] });

  const next = screen.getByRole('button', { name: 'New Gateway…' });

  await expect.element(next).toBeVisible();
  await expect.element(next).toHaveTextContent('');
});

test('before the first gateway exists the group lists no gateway row', async () => {
  const { screen } = await renderSidebar({ gateways: [] });

  await expect.element(screen.getByRole('button', { name: 'New Gateway…' })).toBeVisible();
  await expect
    .element(screen.getByRole('group', { name: 'Local Gateways' }).getByRole('link'))
    .not.toBeInTheDocument();
});

test('once a gateway exists the sidebar offers the way to the next one', async () => {
  const onNewGateway = vi.fn<() => void>();
  const { screen } = await renderSidebar({ gateways: [codex] }, onNewGateway);

  await screen.getByRole('button', { name: 'New Gateway…' }).click();

  expect(onNewGateway).toHaveBeenCalledTimes(1);
});

test('the way to the next gateway sits above the gateways already stored', async () => {
  const { screen } = await renderSidebar({ gateways: [codex] });

  const next = screen.getByRole('button', { name: 'New Gateway…' }).element();
  const stored = screen.getByRole('link', { name: 'Codex Stopped' }).element();

  expect(next.compareDocumentPosition(stored)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
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
