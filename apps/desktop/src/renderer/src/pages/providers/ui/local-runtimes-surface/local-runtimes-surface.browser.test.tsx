import type { AccountsDocument } from '@recompose/contracts';

import { ACCOUNTS_VERSION } from '@recompose/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import type { BridgeParameters } from '../../../../shared/testing';

import { installFakeBridge } from '../../../../shared/testing';
import { LocalRuntimesSurface } from './local-runtimes-surface';

const mixedRegistry: AccountsDocument = {
  schemaVersion: ACCOUNTS_VERSION,
  accounts: [
    { id: 'k1', provider: 'anthropic', kind: 'api-key', label: 'Team key', credentialRef: 'c1' },
    { id: 'l1', provider: 'ollama', kind: 'local', address: 'http://127.0.0.1:11434' },
  ],
};

async function renderSurface(parameters: BridgeParameters = {}) {
  installFakeBridge(parameters);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>Loading…</p>}>
        <LocalRuntimesSurface />
      </Suspense>
    </QueryClientProvider>,
  );
}

test('the surface lists the stored runtimes and nothing held under another kind', async () => {
  const screen = await renderSurface({ accounts: mixedRegistry });

  await expect.element(screen.getByText('http://127.0.0.1:11434')).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Actions for Ollama' })).toBeVisible();
  await expect.element(screen.getByText('Team key')).not.toBeInTheDocument();
});

test('the surface before any runtime connects says what the destination holds', async () => {
  const screen = await renderSurface();

  await expect.element(screen.getByText('Nothing connected yet')).toBeVisible();
  await expect.element(screen.getByText(/local runtime serves models/i)).toBeVisible();
});

test('rows stand at once with the look still out, so a slow look never blanks the page', async () => {
  const screen = await renderSurface({
    accounts: mixedRegistry,
    overrides: { 'accounts:check-runtime': async () => new Promise(() => undefined) },
  });

  await expect.element(screen.getByText('http://127.0.0.1:11434')).toBeVisible();
  await expect.element(screen.getByText('Checking')).toBeVisible();
});
