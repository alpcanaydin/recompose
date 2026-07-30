import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import type { BridgeParameters } from '../../../../shared/testing';

import {
  bindEngineStatesToCache,
  engineStatesQueryOptions,
  gatewaysQueryOptions,
} from '../../../../shared/api';
import { gatewaySeed, installFakeBridge } from '../../../../shared/testing';
import { GatewayToolbar } from './gateway-toolbar';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });
const gemini = gatewaySeed({ slug: 'gemini', displayName: 'Gemini', port: 51235 });

const portTaken = {
  'engine:start': async () =>
    Promise.resolve({
      ok: true as const,
      value: { status: 'stopped' as const, failure: { port: 51234 } },
    }),
};

async function renderToolbar(parameters: BridgeParameters, slug = 'codex') {
  installFakeBridge(parameters);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  await Promise.all([
    queryClient.ensureQueryData(gatewaysQueryOptions),
    queryClient.ensureQueryData(engineStatesQueryOptions),
  ]);

  bindEngineStatesToCache(queryClient);

  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>Loading…</p>}>
        <GatewayToolbar slug={slug} />
      </Suspense>
    </QueryClientProvider>,
  );

  return { screen, queryClient };
}

test('the pill carries the address a person pastes into a client, with no path', async () => {
  const { screen } = await renderToolbar({ gateways: [codex], engineStates: {} });

  await expect.element(screen.getByText('http://')).toBeVisible();
  await expect.element(screen.getByText('localhost:51234')).toBeVisible();
});

test('the pill closes with the state word the gateway stands in', async () => {
  const { screen } = await renderToolbar({
    gateways: [codex],
    engineStates: { codex: { status: 'running' } },
  });

  await expect.element(screen.getByText('Running')).toBeVisible();
});

test('a stopped gateway offers to start and a running one offers to stop', async () => {
  const { screen } = await renderToolbar({ gateways: [codex], engineStates: {} });

  await expect.element(screen.getByRole('button', { name: 'Start' })).toBeVisible();

  await screen.getByRole('button', { name: 'Start' }).click();

  await expect.element(screen.getByRole('button', { name: 'Stop' })).toBeVisible();
});

test('starting the selected gateway reaches that gateway alone', async () => {
  const { screen, queryClient } = await renderToolbar({
    gateways: [codex, gemini],
    engineStates: {},
  });

  await screen.getByRole('button', { name: 'Start' }).click();

  await expect.element(screen.getByRole('button', { name: 'Stop' })).toBeVisible();
  expect(queryClient.getQueryData(engineStatesQueryOptions.queryKey)).toEqual({
    codex: { status: 'running' },
  });
});

test('stopping a running gateway takes it back to stopped', async () => {
  const { screen } = await renderToolbar({
    gateways: [codex],
    engineStates: { codex: { status: 'running' } },
  });

  await screen.getByRole('button', { name: 'Stop' }).click();

  await expect.element(screen.getByRole('button', { name: 'Start' })).toBeVisible();
});

test('the copy affordance puts the bare origin on the clipboard', async () => {
  const { screen } = await renderToolbar({ gateways: [codex], engineStates: {} });

  await screen.getByRole('button', { name: 'Copy address' }).click();

  await expect.element(screen.getByRole('status')).toHaveTextContent('Address copied.');
  expect(await navigator.clipboard.readText()).toBe('http://localhost:51234');
});

test('a start against a taken port names the port and offers a way out', async () => {
  const { screen } = await renderToolbar({
    gateways: [codex],
    engineStates: {},
    overrides: portTaken,
  });

  await screen.getByRole('button', { name: 'Start' }).click();

  await expect
    .element(screen.getByRole('alert'))
    .toHaveTextContent('Another process holds port 51234.');
  await expect.element(screen.getByRole('button', { name: 'Move to a free port' })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Start' })).toBeVisible();
});

test('every failed attempt speaks again, through a node the last attempt never used', async () => {
  const { screen } = await renderToolbar({
    gateways: [codex],
    engineStates: {},
    overrides: portTaken,
  });

  await screen.getByRole('button', { name: 'Start' }).click();

  await expect.element(screen.getByRole('alert')).toBeVisible();

  const spoken = screen.getByRole('alert').element();

  await screen.getByRole('button', { name: 'Start' }).click();

  await expect.element(screen.getByRole('alert')).toBeVisible();
  expect(screen.getByRole('alert').element()).not.toBe(spoken);
});

test('accepting the move puts the gateway on a free port and the pill follows', async () => {
  const { screen } = await renderToolbar({
    gateways: [codex],
    engineStates: {},
    overrides: portTaken,
  });

  await screen.getByRole('button', { name: 'Start' }).click();

  await expect.element(screen.getByRole('button', { name: 'Move to a free port' })).toBeVisible();

  await screen.getByRole('button', { name: 'Move to a free port' }).click();

  await expect.element(screen.getByText('localhost:51235')).toBeVisible();
  await expect.element(screen.getByRole('alert')).not.toBeInTheDocument();
});

test('a gateway that has never failed shows no failure line', async () => {
  const { screen } = await renderToolbar({ gateways: [codex], engineStates: {} });

  await expect.element(screen.getByText('localhost:51234')).toBeVisible();
  await expect.element(screen.getByRole('alert')).not.toBeInTheDocument();
});
