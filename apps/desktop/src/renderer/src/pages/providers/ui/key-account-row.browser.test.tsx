import type { CredentialedAccount } from '@recompose/contracts';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';

import type { BridgeParameters } from '../../../shared/testing';

import { installFakeBridge } from '../../../shared/testing';
import { KeyAccountRow } from './key-account-row';

const stored: CredentialedAccount = {
  id: 'a1',
  provider: 'anthropic',
  kind: 'api-key',
  label: 'build',
  credentialRef: 'c1',
  keyTail: '7f2c',
};

const storedBeforeTheMask: CredentialedAccount = {
  id: 'a1',
  provider: 'anthropic',
  kind: 'api-key',
  label: 'build',
  credentialRef: 'c1',
};

async function renderRow(account: CredentialedAccount, parameters: BridgeParameters = {}) {
  installFakeBridge({ accounts: { schemaVersion: 3, accounts: [account] }, ...parameters });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ul>
        <KeyAccountRow account={account} />
      </ul>
    </QueryClientProvider>,
  );
}

async function press(name: string) {
  const control = page.getByRole('button', { name, exact: true });

  await expect.element(control).toBeVisible();

  control.element().focus();

  await userEvent.keyboard('{Enter}');
}

async function choose(action: string) {
  await press('Actions for build');

  const item = page.getByRole('menuitem', { name: action, exact: true });

  await expect.element(item).toBeVisible();

  item.element().focus();

  await userEvent.keyboard('{Enter}');
}

async function heldAccounts() {
  const answer = await window.recompose['accounts:list']();

  return answer.ok ? answer.value.accounts : [];
}

test('a stored key reads as the product it reaches over the name it was given', async () => {
  const screen = await renderRow(stored);

  await expect.element(screen.getByText('Anthropic API', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('build', { exact: true })).toBeVisible();
});

test('the mask holds four bullets and four characters, with no vendor prefix in front', async () => {
  const screen = await renderRow(stored);

  await expect.element(screen.getByText('••••7f2c', { exact: true })).toBeVisible();
});

test('a key stored before the mask existed reads as its name alone', async () => {
  const screen = await renderRow(storedBeforeTheMask);

  await expect.element(screen.getByText('build', { exact: true })).toBeVisible();
  await expect.element(screen.getByText(/••••/)).not.toBeInTheDocument();
});

test('a key the catalog never offered stands under the provider it was stored as', async () => {
  const screen = await renderRow({ ...stored, provider: 'mistral' });

  await expect.element(screen.getByText('mistral', { exact: true })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Verify' })).not.toBeInTheDocument();
});

test('an aggregator key takes the same row and offers no check, because no probe knows it', async () => {
  const screen = await renderRow({ ...stored, provider: 'openrouter', kind: 'aggregator' });

  await expect.element(screen.getByText('OpenRouter', { exact: true })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Verify' })).not.toBeInTheDocument();
});

test('the overflow holds removal and nothing else', async () => {
  await renderRow(stored);

  await press('Actions for build');

  await expect.element(page.getByRole('menuitem', { name: 'Remove' })).toBeVisible();
  await expect.poll(() => page.getByRole('menuitem').elements().length).toBe(1);
});

test('removing a key takes it out of the registry it was held in', async () => {
  await renderRow(stored);

  await choose('Remove');

  await expect.poll(heldAccounts).toEqual([]);
});

test('a check answers as of the moment it ran rather than as a standing the row keeps', async () => {
  const screen = await renderRow(stored, { keyCheck: 'authenticates' });

  await screen.getByRole('button', { name: 'Verify' }).click();

  await expect.element(screen.getByRole('status')).toHaveTextContent('as of this check');
});

test('a refused check says why on the row rather than leaving the act silent', async () => {
  const screen = await renderRow(stored, {
    overrides: {
      'accounts:check-key': async () =>
        Promise.resolve({
          ok: false,
          error: { code: 'storage-failed', message: 'The stored key is missing.' },
        }),
    },
  });

  await screen.getByRole('button', { name: 'Verify' }).click();

  await expect.element(screen.getByRole('alert')).toHaveTextContent('The stored key is missing.');
});
