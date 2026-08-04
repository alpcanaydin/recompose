import type { AccountsDocument, SubscriptionAccountView } from '@recompose/contracts';

import { ACCOUNTS_VERSION } from '@recompose/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';

import type { AccountKind } from '../../../../entities/account';
import type { BridgeParameters } from '../../../../shared/testing';

import { installFakeBridge } from '../../../../shared/testing';
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
  schemaVersion: ACCOUNTS_VERSION,
  accounts: [
    {
      id: 'a2',
      provider: 'openai',
      kind: 'api-key',
      label: 'Work key',
      credentialRef: 'c2',
      keyTail: '7f2c',
    },
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

async function reach(role: 'button' | 'menuitem', name: string) {
  const control = page.getByRole(role, { name, exact: true });

  await expect.element(control).toBeVisible();

  control.element().focus();

  await userEvent.keyboard('{Enter}');
}

async function chooseFromOverflow(actions: string, action: string) {
  await reach('button', actions);
  await reach('menuitem', action);
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

test('a connected key reads as the product it reaches over its own name and mask', async () => {
  const screen = await renderProviders('api-key', { accounts: keys });

  await expect.element(screen.getByText('OpenAI API', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('••••7f2c', { exact: true })).toBeVisible();
});

test('removing a key account takes its row off the screen', async () => {
  const screen = await renderProviders('api-key', { accounts: keys });

  await chooseFromOverflow('Actions for Work key', 'Remove');

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

  await chooseFromOverflow('Actions for Work key', 'Remove');

  await expect
    .element(screen.getByRole('alert'))
    .toHaveTextContent('Could not write the accounts file');
});

test('a key the provider accepts says so as of the check and claims nothing about spending', async () => {
  const screen = await renderProviders('api-key', { accounts: keys, keyCheck: 'authenticates' });

  await chooseFromOverflow('Actions for Work key', 'Verify');

  await expect
    .element(screen.getByRole('status'))
    .toHaveTextContent('This key authenticated as of this check.');
  await expect.element(screen.getByText(/spend/)).not.toBeInTheDocument();
});

test('a turned-away key reads as not accepted, guessing at no reason for it', async () => {
  const screen = await renderProviders('api-key', { accounts: keys, keyCheck: 'not-accepted' });

  await chooseFromOverflow('Actions for Work key', 'Verify');

  await expect
    .element(screen.getByRole('status'))
    .toHaveTextContent("The provider didn't accept this key as of this check.");
  await expect.element(screen.getByText(/revoked|expired|mistyped/)).not.toBeInTheDocument();
});

test('a check that never reached the provider leaves the key unverified rather than broken', async () => {
  const screen = await renderProviders('api-key', { accounts: keys, keyCheck: 'could-not-check' });

  await chooseFromOverflow('Actions for Work key', 'Verify');

  await expect
    .element(screen.getByRole('status'))
    .toHaveTextContent("This check couldn't reach the provider, so the key stands unverified.");
});

test('no answer outlives the screen it was answered on', async () => {
  const first = await renderProviders('api-key', { accounts: keys, keyCheck: 'authenticates' });

  await chooseFromOverflow('Actions for Work key', 'Verify');

  await expect.element(first.getByRole('status')).toBeVisible();

  await first.unmount();

  const again = await renderProviders('api-key', { accounts: keys, keyCheck: 'authenticates' });

  await expect.element(again.getByText('Work key')).toBeVisible();
  await expect.element(again.getByRole('status')).not.toBeInTheDocument();
});

test('a keys screen with nothing connected explains the kind and lists nothing', async () => {
  const screen = await renderProviders('api-key');

  await expect.element(screen.getByText(/An API key is/)).toBeVisible();
  await expect.element(screen.getByRole('list')).not.toBeInTheDocument();
});

test('the aggregators screen promises a hosted catalog rather than many providers', async () => {
  const screen = await renderProviders('aggregator');

  await expect
    .element(screen.getByText('One key, many models, routed through a hosted catalog.'))
    .toBeVisible();
});

test('an aggregators screen with nothing connected explains the kind and lists nothing', async () => {
  const screen = await renderProviders('aggregator');

  await expect.element(screen.getByText(/An aggregator key is/)).toBeVisible();
  await expect.element(screen.getByRole('list')).not.toBeInTheDocument();
});

test('the local runtimes destination lists what the registry holds under it', async () => {
  const screen = await renderProviders('local', {
    accounts: {
      schemaVersion: ACCOUNTS_VERSION,
      accounts: [
        { id: 'l1', provider: 'ollama', kind: 'local', address: 'http://127.0.0.1:11434' },
      ],
    },
  });

  await expect.element(screen.getByText('http://127.0.0.1:11434')).toBeVisible();
  await expect.element(screen.getByText(/arrive later/)).not.toBeInTheDocument();
});
