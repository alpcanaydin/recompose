import type { SubscriptionAccountView, SubscriptionTool } from '@recompose/contracts';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';

import type { BridgeParameters } from '../../../shared/testing';

import { installFakeBridge } from '../../../shared/testing';
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

test('a connected account carries its provider, its plan, and the address it signed in as', async () => {
  const screen = await renderRow(connected);

  await expect.element(screen.getByText('Anthropic', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('Max', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('dev@example.com')).toBeVisible();
});

test('an account stored under its address still names the provider, and says the address once', async () => {
  const screen = await renderRow({ ...connected, label: 'dev@example.com' });

  await expect.element(screen.getByText('Anthropic', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('dev@example.com')).toBeVisible();
});

test('the row states the account serves the provider tool rather than any gateway', async () => {
  const screen = await renderRow(connected);

  await expect
    .element(screen.getByText(/Serves Claude Code/))
    .toHaveTextContent("Serves Claude Code from this account's quota");
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

test('a connected account keeps its quieter acts behind the overflow', async () => {
  await renderRow({ ...connected, active: false });

  await press('Actions for Anthropic');

  await expect.element(page.getByRole('menuitem', { name: 'Use this account' })).toBeVisible();
  await expect.element(page.getByRole('menuitem', { name: 'Copy shell setup' })).toBeVisible();
  await expect.element(page.getByRole('menuitem', { name: 'Remove' })).toBeVisible();
});

test('the account its provider tool already runs as offers no way to be chosen again', async () => {
  await renderRow(connected);

  await press('Actions for Anthropic');

  await expect.element(page.getByRole('menuitem', { name: 'Remove' })).toBeVisible();
  await expect
    .element(page.getByRole('menuitem', { name: 'Use this account' }))
    .not.toBeInTheDocument();
});

test('choosing an account points its provider tool at that account', async () => {
  const spare: SubscriptionAccountView = { ...connected, id: 's2', active: false };

  await renderRow(spare, { subscriptions: [{ ...connected, active: true }, spare] });

  await choose('Use this account');

  await expect
    .poll(async () => (await heldSubscriptions()).filter((view) => view.active).map((v) => v.id))
    .toEqual(['s2']);
});

test('copying the shell setup hands over the line that points a shell at the account', async () => {
  const clipboard = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

  await renderRow(connected);

  await choose('Copy shell setup');

  await expect.poll(() => clipboard.mock.calls).toEqual([[claudeCode.shellSetupLine]]);

  vi.restoreAllMocks();
});

test('removing an account takes it out of the registry it was held in', async () => {
  await renderRow(connected, {
    accounts: {
      schemaVersion: 2,
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
