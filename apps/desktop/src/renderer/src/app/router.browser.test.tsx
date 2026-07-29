import type { AccountsDocument } from '@recompose/contracts';

import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { accountsQueryOptions } from '../pages/providers';
import {
  gatewayTokenQueryOptions,
  settingsQueryOptions,
  systemQueryOptions,
} from '../pages/settings';
import { installFakeBridge } from '../shared/testing';
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

async function renderAt(path: string, initial?: AccountsDocument) {
  installFakeBridge(initial === undefined ? {} : { accounts: initial });

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

test('the shell shows the sidebar and the empty state at the root', async () => {
  const screen = await renderAt('/');

  await expect.element(screen.getByRole('link', { name: 'Gateways' })).toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'Providers' })).toBeVisible();
  await expect
    .element(screen.getByText('Select a gateway or create one to get started.'))
    .toBeVisible();
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
  const screen = await renderAt('/providers', seededAccounts());

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
