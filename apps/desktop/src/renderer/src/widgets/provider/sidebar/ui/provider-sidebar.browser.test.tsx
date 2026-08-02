import type { AccountsDocument } from '@recompose/contracts';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterContextProvider, createMemoryHistory } from '@tanstack/react-router';
import { Suspense } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { createAppRouter } from '../../../../app/router';
import { accountsQueryOptions } from '../../../../shared/api';
import { installFakeBridge } from '../../../../shared/testing';
import { ProviderSidebar } from './provider-sidebar';

type StoredKind = AccountsDocument['accounts'][number]['kind'];

function stored(kinds: StoredKind[]): AccountsDocument {
  return {
    schemaVersion: 2,
    accounts: kinds.map((kind, index) =>
      kind === 'subscription'
        ? { id: `a${index}`, provider: 'anthropic' as const, kind, label: `Account ${index}` }
        : {
            id: `a${index}`,
            provider: 'anthropic',
            kind,
            label: `Account ${index}`,
            credentialRef: `c${index}`,
          },
    ),
  };
}

async function renderSidebar(accounts: AccountsDocument, at = '/') {
  installFakeBridge({ accounts });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  await queryClient.ensureQueryData(accountsQueryOptions);

  const router = createAppRouter({
    queryClient,
    history: createMemoryHistory({ initialEntries: [at] }),
  });

  await router.load();

  return render(
    <RouterContextProvider router={router}>
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<p>Loading…</p>}>
          <ProviderSidebar />
        </Suspense>
      </QueryClientProvider>
    </RouterContextProvider>,
  );
}

test('every kind an account can be held as gets a row of its own', async () => {
  const screen = await renderSidebar(stored([]));

  await expect
    .element(screen.getByRole('link', { name: 'Subscriptions, 0 connected' }))
    .toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'API Keys, 0 connected' })).toBeVisible();
  await expect
    .element(screen.getByRole('link', { name: 'Aggregators, 0 connected' }))
    .toBeVisible();
  await expect
    .element(screen.getByRole('link', { name: 'Local Runtimes, 0 connected' }))
    .toBeVisible();
});

test('the kind that holds nothing yet still reaches a destination of its own', async () => {
  const screen = await renderSidebar(stored([]));

  await expect
    .poll(() =>
      screen
        .getByRole('link', { name: 'Local Runtimes, 0 connected' })
        .element()
        .getAttribute('href'),
    )
    .toMatch(/\/providers\?kind=local$/);
});

test('a row reports how many accounts are stored under its kind', async () => {
  const screen = await renderSidebar(stored(['api-key', 'subscription', 'api-key']));

  await expect.element(screen.getByRole('link', { name: 'API Keys, 2 connected' })).toBeVisible();
  await expect
    .element(screen.getByRole('link', { name: 'Subscriptions, 1 connected' }))
    .toBeVisible();
});

test('a kind nothing is stored under still reports its count rather than hiding', async () => {
  const screen = await renderSidebar(stored(['api-key']));

  await expect
    .element(screen.getByRole('link', { name: 'Aggregators, 0 connected' }))
    .toBeVisible();
});

test('a row reaches the providers surface narrowed to its kind', async () => {
  const screen = await renderSidebar(stored([]));

  await expect
    .poll(() =>
      screen.getByRole('link', { name: 'API Keys, 0 connected' }).element().getAttribute('href'),
    )
    .toMatch(/\/providers\?kind=api-key$/);
});

test('the kind rows gather under a heading of their own', async () => {
  const screen = await renderSidebar(stored([]));

  const providers = screen.getByRole('group', { name: 'Providers' });

  await expect.element(providers).toBeVisible();
  await expect
    .element(providers.getByRole('link', { name: 'Aggregators, 0 connected' }))
    .toBeVisible();
});

test('the row whose kind the screen shows reads as the current destination', async () => {
  const screen = await renderSidebar(stored([]), '/providers?kind=api-key');

  await expect
    .element(screen.getByRole('link', { name: 'API Keys, 0 connected' }))
    .toHaveAttribute('aria-current', 'page');
  await expect
    .element(screen.getByRole('link', { name: 'Subscriptions, 0 connected' }))
    .not.toHaveAttribute('aria-current');
});
