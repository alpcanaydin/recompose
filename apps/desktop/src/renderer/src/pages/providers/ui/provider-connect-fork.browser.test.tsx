import type { SubscriptionTool } from '@recompose/contracts';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import type { CatalogEntry } from '../model/provider-catalog';

import { installFakeBridge } from '../../../shared/testing';
import { catalogEntries } from '../model/provider-catalog';
import { ProviderConnectFork } from './provider-connect-fork';

const claudeCode: SubscriptionTool = {
  provider: 'anthropic',
  toolName: 'Claude Code',
  present: true,
  signInCommand: 'claude',
  shellSetupLine: 'export CLAUDE_CONFIG_DIR="/tmp/anthropic/active"',
};

function offered(id: CatalogEntry['id']): CatalogEntry {
  const entry = catalogEntries.find((candidate) => candidate.id === id);

  if (entry === undefined) {
    throw new Error(`the catalog offers no ${id}`);
  }

  return entry;
}

function Fork({ entry }: { entry: CatalogEntry }) {
  const [connected, setConnected] = useState(false);

  return connected ? (
    <p>The fork stepped aside.</p>
  ) : (
    <ProviderConnectFork
      entry={entry}
      onConnected={() => {
        setConnected(true);
      }}
    />
  );
}

async function renderFork(entry: CatalogEntry) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>Loading…</p>}>
        <Fork entry={entry} />
      </Suspense>
    </QueryClientProvider>,
  );
}

async function heldSubscriptions() {
  const answer = await window.recompose['subscriptions:list']();

  return answer.ok ? answer.value : [];
}

test('a provider that connects two ways stands both of them together', async () => {
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderFork(offered('anthropic'));

  await expect
    .element(screen.getByRole('heading', { name: 'An account for Claude Code' }))
    .toBeVisible();
  await expect
    .element(screen.getByRole('heading', { name: 'A target a gateway can reach' }))
    .toBeVisible();
});

test('the sign-in way names whose quota the requests draw on', async () => {
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderFork(offered('anthropic'));

  await expect.element(screen.getByText(/draw on your Anthropic plan/)).toBeVisible();
});

test('the sign-in way names whose terms govern it and that access can end unannounced', async () => {
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderFork(offered('anthropic'));

  await expect
    .element(screen.getByText(/Anthropic's terms govern this connection/))
    .toHaveTextContent('without notice');
});

test('a provider that only ever takes a key stands one way rather than a fork', async () => {
  installFakeBridge();

  const screen = await renderFork(offered('openrouter'));

  await expect
    .element(screen.getByRole('heading', { name: 'A target a gateway can reach' }))
    .toBeVisible();
  await expect.element(screen.getByRole('button', { name: /Sign in/ })).not.toBeInTheDocument();
});

test('a tool that is not installed names itself and leaves no sign-in to begin', async () => {
  installFakeBridge({ tools: [{ ...claudeCode, present: false }] });

  const screen = await renderFork(offered('anthropic'));

  await expect.element(screen.getByText(/Claude Code isn't installed/)).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Sign in to Anthropic' })).toBeDisabled();
  expect(await heldSubscriptions()).toEqual([]);
});

test('a sign-in in flight names the tool it waits on and hands over the command it launched', async () => {
  installFakeBridge({
    tools: [claudeCode],
    overrides: { 'subscriptions:sign-in': async () => new Promise(() => undefined) },
  });

  const screen = await renderFork(offered('anthropic'));

  await screen.getByRole('button', { name: 'Sign in to Anthropic' }).click();

  await expect.element(screen.getByText(/Waiting for Claude Code/)).toBeVisible();
  await expect.element(screen.getByText('claude', { exact: true })).toBeVisible();
});

test('a sign-in the tool reported leaves the account behind and the fork with it', async () => {
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderFork(offered('anthropic'));

  await screen.getByRole('button', { name: 'Sign in to Anthropic' }).click();

  await expect.element(screen.getByText('The fork stepped aside.')).toBeVisible();
  expect((await heldSubscriptions()).map((view) => view.provider)).toEqual(['anthropic']);
});

test('a refused sign-in says why rather than waiting on a tool that already answered', async () => {
  installFakeBridge({
    tools: [claudeCode],
    overrides: {
      'subscriptions:sign-in': async () =>
        Promise.resolve({
          ok: false,
          error: { code: 'sign-in-timed-out', message: 'Claude Code never reported a sign-in.' },
        }),
    },
  });

  const screen = await renderFork(offered('anthropic'));

  await screen.getByRole('button', { name: 'Sign in to Anthropic' }).click();

  await expect
    .element(screen.getByRole('alert'))
    .toHaveTextContent('Claude Code never reported a sign-in.');
});
