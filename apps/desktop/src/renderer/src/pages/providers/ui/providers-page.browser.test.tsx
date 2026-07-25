import type { AccountsDocument } from '@recompose/contracts';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { installFakeBridge } from '../../../shared/testing';
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

async function renderProviders() {
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
  installFakeBridge({ accounts: seeded });

  const screen = await renderProviders();

  await expect.element(screen.getByText('Claude Max', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('anthropic · subscription')).toBeVisible();
});

test('connecting a provider adds it to the list and never shows the secret', async () => {
  installFakeBridge({ accounts: seeded });

  const screen = await renderProviders();

  await screen.getByLabelText('Provider').fill('openai');
  await screen.getByLabelText('Label').fill('Work key');
  await screen.getByLabelText('Secret').fill('sk-supersecret');
  await screen.getByRole('button', { name: 'Connect' }).click();

  await expect.element(screen.getByText('Work key', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('sk-supersecret')).not.toBeInTheDocument();
});

test('connecting an aggregator account shows its kind on the new row', async () => {
  installFakeBridge({ accounts: seeded });

  const screen = await renderProviders();

  await screen.getByLabelText('Provider').fill('openai');
  await screen.getByLabelText('Kind').selectOptions('aggregator');
  await screen.getByLabelText('Label').fill('Work key');
  await screen.getByLabelText('Secret').fill('sk-supersecret');
  await screen.getByRole('button', { name: 'Connect' }).click();

  await expect.element(screen.getByText('openai · aggregator')).toBeVisible();
});

test('removing an account deletes its row', async () => {
  installFakeBridge({ accounts: seeded });

  const screen = await renderProviders();

  await screen.getByRole('button', { name: 'Remove Claude Max' }).click();

  await expect.element(screen.getByText('Claude Max')).not.toBeInTheDocument();
});

test('a storage-failed remove surfaces as a visible error', async () => {
  installFakeBridge({
    accounts: seeded,
    overrides: {
      'accounts:remove': async () =>
        Promise.resolve({
          ok: false,
          error: { code: 'storage-failed', message: 'Could not write the accounts file' },
        }),
    },
  });

  const screen = await renderProviders();

  await screen.getByRole('button', { name: 'Remove Claude Max' }).click();

  await expect
    .element(screen.getByRole('alert'))
    .toHaveTextContent('Could not write the accounts file');
});

test('a vault-unavailable failure surfaces as a visible error', async () => {
  installFakeBridge({
    accounts: seeded,
    overrides: {
      'accounts:connect': async () =>
        Promise.resolve({
          ok: false,
          error: { code: 'vault-unavailable', message: 'OS secret encryption is unavailable' },
        }),
    },
  });

  const screen = await renderProviders();

  await screen.getByLabelText('Provider').fill('openai');
  await screen.getByLabelText('Label').fill('Work key');
  await screen.getByLabelText('Secret').fill('sk-x');
  await screen.getByRole('button', { name: 'Connect' }).click();

  await expect.element(screen.getByRole('alert')).toBeVisible();
});
