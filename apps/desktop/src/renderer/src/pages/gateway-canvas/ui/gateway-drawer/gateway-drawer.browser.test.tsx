import type { AccountsDocument, VirtualModel } from '@recompose/contracts';

import { ACCOUNTS_VERSION } from '@recompose/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import type { BridgeParameters } from '../../../../shared/testing';
import type { SettledDefinition } from '../../lib/model-draft';

import { gatewaySeed, installFakeBridge } from '../../../../shared/testing';
import { draftKept, emptyDefinition } from '../../lib/model-draft';
import { GatewayDrawer } from './gateway-drawer';

const registry: AccountsDocument = {
  schemaVersion: ACCOUNTS_VERSION,
  accounts: [
    { id: 'k1', provider: 'anthropic', kind: 'api-key', label: 'work', credentialRef: 'c1' },
    { id: 'k2', provider: 'openai', kind: 'api-key', label: 'personal', credentialRef: 'c2' },
  ],
};

const fast: VirtualModel = {
  id: 'fast',
  displayName: 'Fast',
  target: { accountId: 'k1', providerModel: 'claude-haiku-4-5' },
};

const creative: VirtualModel = {
  id: 'creative',
  displayName: 'Creative',
  target: { accountId: 'k2', providerModel: 'gpt-5' },
};

async function renderDrawer(
  virtualModels: readonly VirtualModel[] = [fast, creative],
  parameters: BridgeParameters = {},
  leaving = false,
) {
  const gateway = gatewaySeed({
    slug: 'my-gateway',
    displayName: 'My Gateway',
    port: 8397,
    virtualModels,
  });

  installFakeBridge({
    accounts: registry,
    gateways: [gateway],
    engineStates: { 'my-gateway': { status: 'running' } },
    ...parameters,
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function DrawerHarness() {
    const [drafting, setDrafting] = useState<SettledDefinition | undefined>(undefined);

    return (
      <GatewayDrawer
        drafting={drafting}
        gateway={gateway}
        leaving={leaving}
        onKeepDrafting={(values) => {
          setDrafting((held) => draftKept(held, values));
        }}
        onLeaveDrafting={() => {
          setDrafting(undefined);
        }}
        onStartDrafting={() => {
          setDrafting(emptyDefinition());
        }}
      />
    );
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>Loading…</p>}>
        <DrawerHarness />
      </Suspense>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

test('the endpoint box hands the base URL a client points at to the clipboard', async () => {
  const written = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
  const screen = await renderDrawer();

  await expect.element(screen.getByText('http://localhost:8397', { exact: true })).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Copy base URL' }));

  expect(written).toHaveBeenCalledWith('http://localhost:8397');
});

test('the endpoint box reads whether the gateway is answering right now', async () => {
  const screen = await renderDrawer();

  await expect.element(screen.getByText('Running', { exact: true })).toBeVisible();
});

test('a stopped gateway reads stopped, because the box speaks for the engine', async () => {
  const screen = await renderDrawer([fast], { engineStates: {} });

  await expect.element(screen.getByText('Stopped', { exact: true })).toBeVisible();
});

test('what a gateway serves reads one row per virtual model, tallied in its heading', async () => {
  const screen = await renderDrawer();

  await expect.element(screen.getByText('· 2 virtual models', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('Fast', { exact: true })).toBeVisible();
  await expect
    .element(screen.getByText('creative → personal · gpt-5', { exact: true }))
    .toBeVisible();
});

test('a gateway serving nothing heads its section with no tally beside it', async () => {
  const screen = await renderDrawer([]);

  expect(screen.getByRole('heading', { name: /Serves/ }).element().textContent).toBe('Serves');
});

test('a gateway already serving offers to add another virtual model', async () => {
  const screen = await renderDrawer();

  await userEvent.click(screen.getByRole('button', { name: 'Add virtual model' }));

  await expect.element(screen.getByRole('textbox', { name: 'Name' })).toBeVisible();
});

test('a gateway serving nothing invites the first virtual model', async () => {
  const screen = await renderDrawer([]);

  await expect.element(screen.getByText('Nothing serves yet', { exact: true })).toBeVisible();
  await expect
    .element(screen.getByText('Add a virtual model to map a name onto a stored account.'))
    .toBeVisible();
});

test('asking for a virtual model swaps the drawer to the flow that defines one', async () => {
  const screen = await renderDrawer([]);

  await userEvent.click(screen.getByRole('button', { name: 'Add virtual model' }));

  await expect.element(screen.getByRole('textbox', { name: 'Name' })).toBeVisible();
  await expect.element(screen.getByText('Endpoint', { exact: true })).not.toBeInTheDocument();
});

test('a drawer on its way off screen still reads the gateway it spoke for', async () => {
  const screen = await renderDrawer([fast], {}, true);

  await expect.element(screen.getByRole('heading', { name: 'My Gateway' })).toBeVisible();
  await expect.element(screen.getByText('Fast', { exact: true })).toBeVisible();
});

test('stepping back from the flow hands the drawer back to what serves', async () => {
  const screen = await renderDrawer([]);

  await userEvent.click(screen.getByRole('button', { name: 'Add virtual model' }));
  await userEvent.click(screen.getByRole('button', { name: 'Back' }));

  await expect.element(screen.getByText('Endpoint', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('Nothing serves yet', { exact: true })).toBeVisible();
});
