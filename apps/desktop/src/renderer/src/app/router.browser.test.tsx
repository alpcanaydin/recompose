import type { AccountsDocument, SubscriptionAccountView } from '@recompose/contracts';

import { ACCOUNTS_VERSION } from '@recompose/contracts';
import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import { settingsQueryOptions, systemQueryOptions } from '../pages/settings';
import {
  accountsQueryOptions,
  subscriptionToolsQueryOptions,
  subscriptionsQueryOptions,
} from '../shared/api';
import { gatewaySeed, installFakeBridge } from '../shared/testing';
import { createQueryClient } from './query-client';
import { createAppRouter } from './router';
import { renderAt } from './testing/render-app';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });
const claude = gatewaySeed({ slug: 'claude', displayName: 'Claude', port: 51235 });

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  onlineManager.setOnline(true);
});

const seededSubscription: SubscriptionAccountView = {
  id: 's1',
  provider: 'anthropic',
  label: 'Anthropic',
  signedInAs: 'dev@example.com',
  plan: 'Max',
  standing: 'connected',
  active: true,
};

function seededAccounts(): AccountsDocument {
  return {
    schemaVersion: ACCOUNTS_VERSION,
    accounts: [{ id: 'a1', provider: 'anthropic', kind: 'subscription', label: 'Claude Max' }],
  };
}

test('the call to action opens the creation sheet with focus in the name field', async () => {
  const screen = await renderAt('/');

  await screen.getByRole('button', { name: 'Create Gateway' }).click();

  await expect.element(screen.getByRole('dialog', { name: 'Create a gateway' })).toBeVisible();
  await expect.element(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
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

test('an unknown path shows the not-found state inside the shell', async () => {
  const screen = await renderAt('/no-such-page');

  await expect.element(screen.getByText('Not found')).toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'Settings' })).toBeVisible();
});

test('navigating to providers loads and renders the accounts from the bridge', async () => {
  const screen = await renderAt('/providers', { subscriptions: [seededSubscription] });

  await expect.element(screen.getByText('dev@example.com')).toBeVisible();
});

test('a request narrowed to a kind lands on the surface for that kind', async () => {
  const screen = await renderAt('/providers?kind=api-key', { accounts: seededAccounts() });

  await expect.element(screen.getByRole('heading', { level: 1, name: 'API Keys' })).toBeVisible();
  await expect.element(screen.getByText('Claude Max', { exact: true })).not.toBeInTheDocument();
});

test('a request naming no kind the contract knows lands on subscriptions', async () => {
  const screen = await renderAt('/providers?kind=not-a-kind', { accounts: seededAccounts() });

  await expect
    .element(screen.getByRole('heading', { level: 1, name: 'Subscriptions' }))
    .toBeVisible();
  await expect.element(screen.getByText('Claude Max', { exact: true })).not.toBeInTheDocument();
});

test('the /providers route loader warms the query cache before any component renders', async () => {
  const seeded = seededAccounts();

  installFakeBridge({ accounts: seeded, subscriptions: [seededSubscription] });

  const queryClient = createQueryClient();
  const router = createAppRouter({
    queryClient,
    history: createMemoryHistory({ initialEntries: ['/providers'] }),
  });

  await router.load();

  expect(queryClient.getQueryData(accountsQueryOptions.queryKey)).toEqual(seeded);
  expect(queryClient.getQueryData(subscriptionsQueryOptions.queryKey)).toEqual([
    seededSubscription,
  ]);
  expect(queryClient.getQueryData(subscriptionToolsQueryOptions.queryKey)).toEqual([]);
});

test('the /providers route loader settles while the machine reports itself offline', async () => {
  const seeded = seededAccounts();

  installFakeBridge({ accounts: seeded, subscriptions: [seededSubscription] });

  onlineManager.setOnline(false);

  const queryClient = createQueryClient();
  const router = createAppRouter({
    queryClient,
    history: createMemoryHistory({ initialEntries: ['/providers'] }),
  });

  await router.load();

  expect(queryClient.getQueryData(accountsQueryOptions.queryKey)).toEqual(seeded);
  expect(queryClient.getQueryData(subscriptionsQueryOptions.queryKey)).toEqual([
    seededSubscription,
  ]);
  expect(queryClient.getQueryData(subscriptionToolsQueryOptions.queryKey)).toEqual([]);
});

test('a request for the usage path lands on the usage screen inside the shell', async () => {
  const screen = await renderAt('/usage');

  await expect.element(screen.getByRole('heading', { level: 1, name: 'Usage' })).toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'Settings' })).toBeVisible();
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

test('the /settings route loader warms the settings and system caches before any component renders', async () => {
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

test('the sidebar offers no way home, because home is no longer a place', async () => {
  const screen = await renderAt('/', { gateways: [codex] });

  await expect.element(screen.getByRole('link', { name: 'Settings' })).toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'Gateways' })).not.toBeInTheDocument();
});

test('a launch opens the gateway the last session was looking at', async () => {
  const first = await renderAt('/gateways/claude', { gateways: [codex, claude] });

  await expect.element(first.getByRole('heading', { name: 'claude' })).toBeVisible();

  await first.unmount();

  const second = await renderAt('/', { gateways: [codex, claude] });

  await expect.element(second.getByRole('heading', { name: 'claude' })).toBeVisible();
});

test('a launch whose remembered gateway has gone invites a new one instead', async () => {
  const first = await renderAt('/gateways/claude', { gateways: [codex, claude] });

  await expect.element(first.getByRole('heading', { name: 'claude' })).toBeVisible();

  await first.unmount();

  const second = await renderAt('/', { gateways: [] });

  await expect
    .element(second.getByRole('heading', { name: 'Create your first gateway', level: 1 }))
    .toBeVisible();
});

test('a launch remembering nothing lands on the invitation', async () => {
  const screen = await renderAt('/', { gateways: [] });

  await expect
    .element(screen.getByRole('heading', { name: 'Create your first gateway', level: 1 }))
    .toBeVisible();
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

  screen.getByRole('link', { name: 'Usage' }).element().focus();

  await expect.element(launch).not.toHaveFocus();

  history.push('/settings?focus=first-control&at=2');

  await expect.element(launch).toHaveFocus();
});
