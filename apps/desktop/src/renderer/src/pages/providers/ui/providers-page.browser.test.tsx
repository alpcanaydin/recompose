import type { AccountsDocument, SubscriptionAccountView } from '@recompose/contracts';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import type { AccountKind } from '../../../entities/account';
import type { BridgeParameters } from '../../../shared/testing';

import { installFakeBridge } from '../../../shared/testing';
import { ProvidersPage } from './providers-page';

const anthropic: SubscriptionAccountView = {
  id: 's1',
  provider: 'anthropic',
  label: 'Anthropic',
  signedInAs: 'dev@example.com',
  plan: 'Max',
  standing: 'connected',
  active: true,
};

const openai: SubscriptionAccountView = {
  id: 's2',
  provider: 'openai',
  label: 'OpenAI',
  standing: 'connected',
  active: true,
};

const keys: AccountsDocument = {
  schemaVersion: 3,
  accounts: [
    { id: 'a2', provider: 'openai', kind: 'api-key', label: 'Work key', credentialRef: 'c2' },
  ],
};

async function renderProviders(kind: AccountKind, parameters: BridgeParameters = {}) {
  installFakeBridge(parameters);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>Loading…</p>}>
        <ProvidersPage kind={kind} />
      </Suspense>
    </QueryClientProvider>,
  );
}

function controlNames(elements: readonly Element[]) {
  return elements.map((control) => control.getAttribute('aria-label') ?? control.textContent);
}

test('the subscriptions screen names the kind it holds and what that kind is', async () => {
  const screen = await renderProviders('subscription');

  await expect
    .element(screen.getByRole('heading', { level: 1, name: 'Subscriptions' }))
    .toBeVisible();
  await expect.element(screen.getByText(/command-line tool/).first()).toBeVisible();
});

test('a subscriptions screen with nothing connected explains the kind and lists nothing', async () => {
  const screen = await renderProviders('subscription');

  await expect.element(screen.getByText(/A subscription account is/)).toBeVisible();
  await expect.element(screen.getByRole('list')).not.toBeInTheDocument();
});

test('every connected subscription stands as its own row', async () => {
  const screen = await renderProviders('subscription', { subscriptions: [anthropic, openai] });

  await expect.element(screen.getByText('dev@example.com')).toBeVisible();
  await expect.poll(() => screen.getByRole('listitem').elements().length).toEqual(2);
});

test("a screen holding rows offers only each row's own acts", async () => {
  const screen = await renderProviders('subscription', { subscriptions: [anthropic, openai] });

  await expect
    .poll(() => controlNames(screen.getByRole('button').elements()))
    .toEqual(['Actions for Anthropic', 'Actions for OpenAI']);
});

test('a screen with nothing connected offers nothing to press', async () => {
  const screen = await renderProviders('subscription');

  await expect.element(screen.getByText(/A subscription account is/)).toBeVisible();
  await expect.poll(() => screen.getByRole('button').elements()).toEqual([]);
});

test('a screen narrowed to keys lists the keys and never a subscription', async () => {
  const screen = await renderProviders('api-key', { accounts: keys, subscriptions: [anthropic] });

  await expect.element(screen.getByText('Work key', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('Anthropic', { exact: true })).not.toBeInTheDocument();
});

test('removing a key account takes its row off the screen', async () => {
  const screen = await renderProviders('api-key', { accounts: keys });

  await screen.getByRole('button', { name: 'Remove Work key' }).click();

  await expect.element(screen.getByText('Work key')).not.toBeInTheDocument();
});

test('a storage-failed remove surfaces as a visible error', async () => {
  const screen = await renderProviders('api-key', {
    accounts: keys,
    overrides: {
      'accounts:remove': async () =>
        Promise.resolve({
          ok: false,
          error: { code: 'storage-failed', message: 'Could not write the accounts file' },
        }),
    },
  });

  await screen.getByRole('button', { name: 'Remove Work key' }).click();

  await expect
    .element(screen.getByRole('alert'))
    .toHaveTextContent('Could not write the accounts file');
});

test('a keys screen with nothing connected explains the kind and lists nothing', async () => {
  const screen = await renderProviders('api-key');

  await expect.element(screen.getByText(/An API key is/)).toBeVisible();
  await expect.element(screen.getByRole('list')).not.toBeInTheDocument();
});

test('an aggregators screen with nothing connected explains the kind and lists nothing', async () => {
  const screen = await renderProviders('aggregator');

  await expect.element(screen.getByText(/An aggregator key is/)).toBeVisible();
  await expect.element(screen.getByRole('list')).not.toBeInTheDocument();
});

test('the local runtimes destination says its surface follows rather than standing blank', async () => {
  const screen = await renderProviders('local');

  await expect.element(screen.getByText(/A local runtime/)).toBeVisible();
  await expect.poll(() => screen.getByRole('button').elements()).toEqual([]);
});
