import type { SubscriptionAccountView, SubscriptionTool } from '@recompose/contracts';

import { ACCOUNTS_VERSION } from '@recompose/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';

import type { BridgeParameters } from '../../../../shared/testing';

import { installFakeBridge } from '../../../../shared/testing';
import { SubscriptionAccountRow } from './subscription-account-row';

const claudeCode: SubscriptionTool = {
  provider: 'anthropic',
  toolName: 'Claude Code',
  present: true,
  signInCommand: 'claude',
  shellSetupLine: 'export CLAUDE_CONFIG_DIR="/tmp/anthropic/active"',
};

const connected: SubscriptionAccountView = {
  id: 's1',
  provider: 'anthropic',
  label: 'Anthropic',
  signedInAs: 'dev@example.com',
  plan: 'Max',
  standing: 'connected',
  active: true,
};

async function renderRow(view: SubscriptionAccountView, parameters: BridgeParameters = {}) {
  installFakeBridge({ tools: [claudeCode], subscriptions: [view], ...parameters });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>Loading…</p>}>
        <ul>
          <SubscriptionAccountRow view={view} />
        </ul>
      </Suspense>
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
  await press('Actions for Anthropic');

  const item = page.getByRole('menuitem', { name: action, exact: true });

  await expect.element(item).toBeVisible();

  item.element().focus();

  await userEvent.keyboard('{Enter}');
}

async function heldSubscriptions() {
  const answer = await window.recompose['subscriptions:list']();

  return answer.ok ? answer.value : [];
}

test('a connected account carries its plan product, its plan, and the address it signed in as', async () => {
  const screen = await renderRow(connected);

  await expect.element(screen.getByText('Claude', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('Max', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('dev@example.com')).toBeVisible();
});

test('an account stored under its address still names the plan product, and says the address once', async () => {
  const screen = await renderRow({ ...connected, label: 'dev@example.com' });

  await expect.element(screen.getByText('Claude', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('dev@example.com')).toBeVisible();
});

test('the row holds who it is and the address alone, because the connect step already taught the rest', async () => {
  const screen = await renderRow(connected);

  await expect.element(screen.getByText(/Serves/)).not.toBeInTheDocument();
});

test('a connected account reads as connected in a word rather than in a color alone', async () => {
  const screen = await renderRow(connected);

  await expect.element(screen.getByText('Connected')).toBeVisible();
});

test('a lapsed account reports the lapse rather than reading as connected', async () => {
  const screen = await renderRow({ ...connected, standing: 'lapsed' });

  await expect.element(screen.getByText('Signed out')).toBeVisible();
  await expect.element(screen.getByText('Connected')).not.toBeInTheDocument();
});

test('a lapsed account carries its way back on the row rather than behind the overflow', async () => {
  await renderRow({ ...connected, standing: 'lapsed' });

  await press('Sign in again');

  await expect
    .poll(async () => (await heldSubscriptions()).map((view) => view.standing))
    .toEqual(['connected']);
});

test('a refused restore says why on the row rather than leaving it unchanged in silence', async () => {
  const screen = await renderRow(
    { ...connected, standing: 'lapsed' },
    {
      overrides: {
        'subscriptions:restore': async () =>
          Promise.resolve({
            ok: false,
            error: { code: 'tool-missing', message: 'Claude Code is not installed.' },
          }),
      },
    },
  );

  await press('Sign in again');

  await expect
    .element(screen.getByRole('alert'))
    .toHaveTextContent('Claude Code is not installed.');
});

test('the overflow holds signing in again and removal, and nothing else', async () => {
  await renderRow({ ...connected, active: false });

  await press('Actions for Anthropic');

  await expect.element(page.getByRole('menuitem', { name: 'Sign in again' })).toBeVisible();
  await expect.element(page.getByRole('menuitem', { name: 'Remove' })).toBeVisible();
  await expect.poll(() => page.getByRole('menuitem').elements().length).toBe(2);
});

test('removing an account takes it out of the registry it was held in', async () => {
  await renderRow(connected, {
    accounts: {
      schemaVersion: ACCOUNTS_VERSION,
      accounts: [{ id: 's1', kind: 'subscription', label: 'Anthropic', provider: 'anthropic' }],
    },
  });

  await choose('Remove');

  await expect
    .poll(async () => {
      const registry = await window.recompose['accounts:list']();

      return registry.ok ? registry.value.accounts : [];
    })
    .toEqual([]);
});
