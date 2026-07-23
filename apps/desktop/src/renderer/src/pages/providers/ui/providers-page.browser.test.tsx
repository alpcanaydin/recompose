import type { AccountsDocument, RecomposeIpc } from '@recompose/contracts';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { ProvidersPage } from './providers-page';

const seeded: AccountsDocument = {
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

function bridgeWith(overrides: Partial<RecomposeIpc> = {}, initial: AccountsDocument = seeded) {
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
            id: 'a2',
            provider: request.provider,
            kind: request.kind,
            label: request.label,
            credentialRef: 'c2',
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
    ...overrides,
  };
}

function renderProviders() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>Loading…</p>}>
        <ProvidersPage />
      </Suspense>
    </QueryClientProvider>,
  );
}

test('the providers screen lists connected accounts from the registry', async () => {
  bridgeWith();

  const screen = await renderProviders();

  await expect.element(screen.getByText('Claude Max', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('anthropic · subscription')).toBeVisible();
});

test('connecting a provider adds it to the list and never shows the secret', async () => {
  bridgeWith();

  const screen = await renderProviders();

  await screen.getByLabelText('Provider').fill('openai');
  await screen.getByLabelText('Label').fill('Work key');
  await screen.getByLabelText('Secret').fill('sk-supersecret');
  await screen.getByRole('button', { name: 'Connect' }).click();

  await expect.element(screen.getByText('Work key', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('sk-supersecret')).not.toBeInTheDocument();
});

test('connecting an aggregator account shows its kind on the new row', async () => {
  bridgeWith();

  const screen = await renderProviders();

  await screen.getByLabelText('Provider').fill('openai');
  await screen.getByLabelText('Kind').selectOptions('aggregator');
  await screen.getByLabelText('Label').fill('Work key');
  await screen.getByLabelText('Secret').fill('sk-supersecret');
  await screen.getByRole('button', { name: 'Connect' }).click();

  await expect.element(screen.getByText('openai · aggregator')).toBeVisible();
});

test('removing an account deletes its row', async () => {
  bridgeWith();

  const screen = await renderProviders();

  await screen.getByRole('button', { name: 'Remove Claude Max' }).click();

  await expect.element(screen.getByText('Claude Max')).not.toBeInTheDocument();
});

test('a storage-failed remove surfaces as a visible error', async () => {
  bridgeWith({
    'accounts:remove': () =>
      Promise.resolve({
        ok: false,
        error: { code: 'storage-failed', message: 'Could not write the accounts file' },
      }),
  });

  const screen = await renderProviders();

  await screen.getByRole('button', { name: 'Remove Claude Max' }).click();

  await expect
    .element(screen.getByRole('alert'))
    .toHaveTextContent('Could not write the accounts file');
});

test('a vault-unavailable failure surfaces as a visible error', async () => {
  bridgeWith({
    'accounts:connect': () =>
      Promise.resolve({
        ok: false,
        error: { code: 'vault-unavailable', message: 'OS secret encryption is unavailable' },
      }),
  });

  const screen = await renderProviders();

  await screen.getByLabelText('Provider').fill('openai');
  await screen.getByLabelText('Label').fill('Work key');
  await screen.getByLabelText('Secret').fill('sk-x');
  await screen.getByRole('button', { name: 'Connect' }).click();

  await expect.element(screen.getByRole('alert')).toBeVisible();
});
