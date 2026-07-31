import type { AccountsDocument } from '@recompose/contracts';

import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import type { BridgeParameters } from '../shared/testing';

import { accountsQueryOptions } from '../pages/providers';
import {
  gatewayTokenQueryOptions,
  settingsQueryOptions,
  systemQueryOptions,
} from '../pages/settings';
import { gatewaySeed, installFakeBridge } from '../shared/testing';
import { createQueryClient } from './query-client';
import { createAppRouter } from './router';

function seededAccounts(): AccountsDocument {
  return {
    schemaVersion: 1,
    accounts: [
      {
        id: 'a1',
        provider: 'anthropic',
        kind: 'subscription',
        label: 'Claude Max',
        credentialRef: 'c1',
      },
    ],
  };
}

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });

async function renderAt(path: string, parameters: BridgeParameters = {}) {
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

test('the shell shows the sidebar and the invitation at the root', async () => {
  const screen = await renderAt('/');

  await expect.element(screen.getByRole('link', { name: 'Gateways' })).toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'Providers' })).toBeVisible();
  await expect
    .element(screen.getByRole('heading', { name: 'Create your first gateway', level: 1 }))
    .toBeVisible();
});

test('the call to action opens the creation sheet with focus in the name field', async () => {
  const screen = await renderAt('/');

  await screen.getByRole('button', { name: 'Create Gateway' }).click();

  await expect.element(screen.getByRole('dialog', { name: 'Create a gateway' })).toBeVisible();
  await expect.element(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
});

test('the sidebar reaches the creation sheet once the empty state has left', async () => {
  const screen = await renderAt('/', { gateways: [codex] });

  await expect
    .element(screen.getByRole('heading', { name: 'Create your first gateway' }))
    .not.toBeInTheDocument();

  await screen.getByRole('button', { name: 'New Gateway…' }).click();

  await expect.element(screen.getByRole('dialog', { name: 'Create a gateway' })).toBeVisible();
});

test('the keyboard path opens the sheet over any surface and hands that surface back', async () => {
  const screen = await renderAt('/settings?create=true&at=1');

  await expect.element(screen.getByRole('dialog', { name: 'Create a gateway' })).toBeVisible();

  await userEvent.keyboard('{Escape}');

  await expect
    .element(screen.getByRole('dialog', { name: 'Create a gateway' }))
    .not.toBeInTheDocument();
  await expect.element(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
});

test('a gateway saved from the sheet reaches the sidebar as a running row', async () => {
  const screen = await renderAt('/');

  await screen.getByRole('button', { name: 'Create Gateway' }).click();
  await screen.getByRole('textbox', { name: 'Name' }).fill('Codex');
  await screen.getByRole('textbox', { name: 'Slug' }).fill('codex');

  screen.getByRole('button', { name: 'Create Gateway' }).last().element().focus();

  await userEvent.keyboard('{Enter}');

  await expect.element(screen.getByRole('link', { name: 'Codex Running' })).toBeVisible();
});

test('a selected gateway puts its address and its control in the toolbar', async () => {
  const screen = await renderAt('/gateways/codex', { gateways: [codex] });

  await expect.element(screen.getByText('localhost:51234')).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Start' })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Copy address' })).toBeVisible();
});

test('a surface with no gateway selected leaves the toolbar empty chrome', async () => {
  const screen = await renderAt('/', { gateways: [codex] });

  await expect.element(screen.getByRole('link', { name: 'Codex Stopped' })).toBeVisible();
  await expect
    .element(screen.getByRole('button', { name: 'Copy address' }))
    .not.toBeInTheDocument();
});

test('a gateway surface reads what its traffic is carrying', async () => {
  const screen = await renderAt('/gateways/codex', { gateways: [codex] });

  await expect.element(screen.getByText(/req\/min/u)).toBeVisible();
  await expect.element(screen.getByText(/nodes/u)).toBeVisible();
});

test('a surface holding no gateway carries no traffic reading', async () => {
  const screen = await renderAt('/', { gateways: [codex] });

  await expect.element(screen.getByText(/req\/min/u)).not.toBeInTheDocument();
});

test('an unknown path shows the not-found state inside the shell', async () => {
  const screen = await renderAt('/no-such-page');

  await expect.element(screen.getByText('Not found')).toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'Providers' })).toBeVisible();
});

test('clicking the providers link navigates to the providers screen', async () => {
  const screen = await renderAt('/');

  await screen.getByRole('link', { name: 'Providers' }).click();

  await expect.element(screen.getByRole('heading', { name: 'Providers' })).toBeVisible();
});

test('navigating to providers loads and renders the registry from the bridge', async () => {
  const screen = await renderAt('/providers', { accounts: seededAccounts() });

  await expect.element(screen.getByText('Claude Max', { exact: true })).toBeVisible();
});

test('the /providers route loader warms the query cache before any component renders', async () => {
  const seeded = seededAccounts();

  installFakeBridge({ accounts: seeded });

  const queryClient = createQueryClient();
  const router = createAppRouter({
    queryClient,
    history: createMemoryHistory({ initialEntries: ['/providers'] }),
  });

  await router.load();

  expect(queryClient.getQueryData(accountsQueryOptions.queryKey)).toEqual(seeded);
});

test('the sidebar carries a System group holding Settings', async () => {
  const screen = await renderAt('/');

  const system = screen.getByRole('group', { name: 'System' });

  await expect.element(system).toBeVisible();
  await expect.element(system.getByRole('link', { name: 'Settings' })).toBeVisible();
});

test('clicking the settings link navigates to the settings screen', async () => {
  const screen = await renderAt('/');

  await screen.getByRole('link', { name: 'Settings' }).click();

  await expect.element(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
});

test('arriving at settings through the shortcut lands focus on the first control', async () => {
  const screen = await renderAt('/settings?focus=first-control');

  await expect.element(screen.getByRole('switch', { name: 'Launch at login' })).toHaveFocus();
});

test('arriving at settings through the sidebar leaves focus where the person put it', async () => {
  const screen = await renderAt('/');

  const settings = screen.getByRole('link', { name: 'Settings' });

  await settings.click();

  await expect.element(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  await expect.element(screen.getByRole('switch', { name: 'Launch at login' })).not.toHaveFocus();
  await expect.element(settings).toHaveFocus();
});

test('the /settings route loader warms the settings, system, and token caches before any component renders', async () => {
  installFakeBridge();

  const queryClient = createQueryClient();
  const router = createAppRouter({
    queryClient,
    history: createMemoryHistory({ initialEntries: ['/settings'] }),
  });

  await router.load();

  expect(queryClient.getQueryData(settingsQueryOptions.queryKey)).toMatchObject({
    theme: 'system',
  });
  expect(queryClient.getQueryData(systemQueryOptions.queryKey)).toMatchObject({
    fileBrowser: 'finder',
  });
  expect(queryClient.getQueryData(gatewayTokenQueryOptions.queryKey)).toEqual({
    ok: true,
    value: { masked: null, storage: 'available' },
  });
});

test('a valid gateway slug shows the canvas placeholder for that gateway', async () => {
  const screen = await renderAt('/gateways/my-gateway');

  await expect.element(screen.getByRole('heading', { name: 'my-gateway' })).toBeVisible();
  await expect.element(screen.getByText('Canvas coming soon.')).toBeVisible();
});

test('an invalid gateway slug lands on the not-found state', async () => {
  const screen = await renderAt('/gateways/Not%20A%20Slug');

  await expect.element(screen.getByText('Not found')).toBeVisible();
});

test('every build defaults to hash-based history, so one url shape reaches the window', () => {
  try {
    const router = createAppRouter({ queryClient: createQueryClient() });

    router.history.push('/providers');
    router.history.flush();

    expect(window.location.hash).toBe('#/providers');
  } finally {
    window.location.hash = '';
  }
});

test('pressing the shortcut again brings focus back to the first control', async () => {
  installFakeBridge();

  const queryClient = createQueryClient();
  const history = createMemoryHistory({ initialEntries: ['/settings?focus=first-control&at=1'] });
  const router = createAppRouter({ queryClient, history });

  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  const launch = screen.getByRole('switch', { name: 'Launch at login' });

  await expect.element(launch).toHaveFocus();

  screen.getByRole('link', { name: 'Providers' }).element().focus();

  await expect.element(launch).not.toHaveFocus();

  history.push('/settings?focus=first-control&at=2');

  await expect.element(launch).toHaveFocus();
});
