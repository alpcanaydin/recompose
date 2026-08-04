import type { SubscriptionTool } from '@recompose/contracts';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import type { CatalogEntry } from '../../model/provider-catalog';

import { subscriptionToolsQueryOptions } from '../../../../shared/api';
import { installFakeBridge } from '../../../../shared/testing';
import { catalogEntries } from '../../model/provider-catalog';
import { ProviderConnectWay } from './provider-connect-way';

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

import type { ConnectionWay } from '../../model/provider-catalog';

function Fork({ entry, way }: { entry: CatalogEntry; way: ConnectionWay }) {
  const [connected, setConnected] = useState(false);

  return connected ? (
    <p>The fork stepped aside.</p>
  ) : (
    <ProviderConnectWay
      entry={entry}
      onConnected={() => {
        setConnected(true);
      }}
      way={way}
    />
  );
}

function newQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

async function renderFork(
  entry: CatalogEntry,
  way: ConnectionWay = 'subscription',
  queryClient = newQueryClient(),
) {
  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>Loading…</p>}>
        <Fork entry={entry} way={way} />
      </Suspense>
    </QueryClientProvider>,
  );
}

async function heldSubscriptions() {
  const answer = await window.recompose['subscriptions:list']();

  return answer.ok ? answer.value : [];
}

test('a subscription pick stands only the sign-in way, with nothing about gateways', async () => {
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderFork(offered('anthropic'), 'subscription');

  await expect
    .element(screen.getByRole('heading', { name: 'An account for Claude Code' }))
    .toBeVisible();
  await expect
    .element(screen.getByRole('heading', { name: 'A target a gateway can reach' }))
    .not.toBeInTheDocument();
  await expect.element(screen.getByLabelText('Key', { exact: true })).not.toBeInTheDocument();
});

test('a key pick stands only the key it still needs, with no sign-in beside it', async () => {
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderFork(offered('anthropic'), 'api-key');

  await expect.element(screen.getByLabelText('Key', { exact: true })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: /Sign in/ })).not.toBeInTheDocument();
  await expect
    .element(screen.getByRole('heading', { name: 'A target a gateway can reach' }))
    .not.toBeInTheDocument();
});

test('the sign-in says in one line whose plan it spends and whose terms govern it', async () => {
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderFork(offered('anthropic'));

  await expect
    .element(screen.getByText(/spends your Anthropic plan/))
    .toHaveTextContent("under Anthropic's terms");
});

test('the sign-in warns that the tool serves one account at a time', async () => {
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderFork(offered('anthropic'));

  await expect.element(screen.getByText(/Claude Code serves one account at a time/)).toBeVisible();
});

test('an aggregator pick asks for its one key and nothing else', async () => {
  installFakeBridge();

  const screen = await renderFork(offered('openrouter'), 'aggregator');

  await expect.element(screen.getByLabelText('Key', { exact: true })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: /Sign in/ })).not.toBeInTheDocument();
});

test('a local pick stands the detect step, which looks without asking', async () => {
  installFakeBridge({ reachability: { verdict: 'answers', version: '0.5.1' } });

  const screen = await renderFork(offered('ollama'), 'local');

  await expect.element(screen.getByText('Ollama is running at 127.0.0.1:11434.')).toBeVisible();
  await expect.element(screen.getByLabelText('Key', { exact: true })).not.toBeInTheDocument();
  await expect.element(screen.getByRole('button', { name: /Sign in/ })).not.toBeInTheDocument();
});

test('adding the detected runtime steps the fork aside like any other connect', async () => {
  installFakeBridge({ reachability: { verdict: 'answers', version: '0.5.1' } });

  const screen = await renderFork(offered('ollama'), 'local');

  await screen.getByRole('button', { name: 'Add Ollama' }).click();

  await expect.element(screen.getByText('The fork stepped aside.')).toBeVisible();
});

test('a tool that is not installed names itself and leaves no sign-in to begin', async () => {
  installFakeBridge({ tools: [{ ...claudeCode, present: false }] });

  const screen = await renderFork(offered('anthropic'));

  await expect.element(screen.getByText(/Claude Code isn't installed/)).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Sign in to Anthropic' })).toBeDisabled();
  expect(await heldSubscriptions()).toEqual([]);
});

test('a tool installed since the last look is signable-in as soon as the fork opens again', async () => {
  installFakeBridge({ tools: [{ ...claudeCode, present: false }] });

  const queryClient = newQueryClient();

  await queryClient.fetchQuery(subscriptionToolsQueryOptions);
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderFork(offered('anthropic'), 'subscription', queryClient);

  await expect.element(screen.getByRole('button', { name: 'Sign in to Anthropic' })).toBeEnabled();
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
