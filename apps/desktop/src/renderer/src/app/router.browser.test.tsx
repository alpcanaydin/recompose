import type { AccountsDocument } from '@recompose/contracts';

import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { accountsQueryOptions } from '../pages/providers';
import { createQueryClient } from './query-client';
import { createAppRouter } from './router';

function emptyAccounts(): AccountsDocument {
  return { schemaVersion: 1, accounts: [] };
}

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

function installFakeBridge(initial: AccountsDocument = emptyAccounts()) {
  let registry = initial;

  window.recompose = {
    'gateways:list': () => Promise.resolve({ ok: true, value: [] }),
    'gateways:save': () => Promise.resolve({ ok: true, value: [] }),
    'settings:get': () =>
      Promise.resolve({
        ok: true,
        value: { schemaVersion: 1, theme: 'system', enginePort: 8397 },
      }),
    'settings:save': (settings) => Promise.resolve({ ok: true, value: settings }),
    'accounts:list': () => Promise.resolve({ ok: true, value: registry }),
    'accounts:connect': (request) => {
      registry = {
        ...registry,
        accounts: [
          ...registry.accounts,
          {
            id: `acc-${registry.accounts.length + 1}`,
            provider: request.provider,
            kind: request.kind,
            label: request.label,
            credentialRef: `cred-${registry.accounts.length + 1}`,
          },
        ],
      };

      return Promise.resolve({ ok: true, value: registry });
    },
    'accounts:remove': (request) => {
      registry = {
        ...registry,
        accounts: registry.accounts.filter((row) => row.id !== request.id),
      };

      return Promise.resolve({ ok: true, value: registry });
    },
  };
}

async function renderAt(path: string, initial: AccountsDocument = emptyAccounts()) {
  installFakeBridge(initial);

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

  installFakeBridge(seeded);

  const queryClient = createQueryClient();
  const router = createAppRouter({
    queryClient,
    history: createMemoryHistory({ initialEntries: ['/providers'] }),
  });

  await router.load();

  expect(queryClient.getQueryData(accountsQueryOptions.queryKey)).toEqual(seeded);
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

test('production builds default to hash-based history so file:// navigation works', () => {
  import.meta.env.PROD = true;

  try {
    const router = createAppRouter({ queryClient: createQueryClient() });

    router.history.push('/providers');
    router.history.flush();

    expect(window.location.hash).toBe('#/providers');
  } finally {
    import.meta.env.PROD = false;
    window.location.hash = '';
  }
});
