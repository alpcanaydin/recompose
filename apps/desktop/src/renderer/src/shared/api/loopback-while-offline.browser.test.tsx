import type { AccountsDocument, RuntimeReachability, SubscriptionTool } from '@recompose/contracts';

import { ACCOUNTS_VERSION } from '@recompose/contracts';
import { onlineManager, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Suspense } from 'react';
import { afterEach, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';

import type { BridgeParameters } from '../testing';

import { createQueryClient } from '../../app/query-client';
import { ProvidersPage } from '../../pages/providers';
import { installFakeBridge } from '../testing';
import {
  runtimeDetectionQueryOptions,
  runtimeStandingQueryOptions,
  useConnectLocalRuntime,
} from './accounts';
import { subscriptionToolsQueryOptions } from './subscriptions';

const nothingObserved = 'nothing observed';

const claudeCode: SubscriptionTool = {
  provider: 'anthropic',
  toolName: 'Claude Code',
  present: true,
  signInCommand: 'claude',
  shellSetupLine: 'export CLAUDE_CONFIG_DIR="/tmp/anthropic/active"',
};

const storedOllama: AccountsDocument = {
  schemaVersion: ACCOUNTS_VERSION,
  accounts: [{ id: 'l1', provider: 'ollama', kind: 'local', address: 'http://127.0.0.1:11434' }],
};

function verdictOf(reachability: RuntimeReachability | undefined): string {
  return reachability === undefined ? nothingObserved : reachability.verdict;
}

function LoopbackProbe() {
  const detection = useQuery(runtimeDetectionQueryOptions('ollama'));
  const standing = useQuery(runtimeStandingQueryOptions('l1'));
  const tools = useQuery(subscriptionToolsQueryOptions);
  const connect = useConnectLocalRuntime();

  return (
    <>
      <p>Detected {verdictOf(detection.data)}</p>
      <p>Standing {verdictOf(standing.data)}</p>
      <p>
        Tools{' '}
        {tools.data === undefined
          ? nothingObserved
          : tools.data.map((tool) => tool.toolName).join(', ')}
      </p>
      <button
        onClick={() => {
          connect.mutate({ runtime: 'ollama' });
        }}
        type="button"
      >
        Add anyway
      </button>
    </>
  );
}

async function openProbeWithTheMachineOffline() {
  installFakeBridge({
    reachability: { verdict: 'answers', version: '0.5.1' },
    tools: [claudeCode],
  });

  onlineManager.setOnline(false);

  return render(
    <QueryClientProvider client={createQueryClient()}>
      <LoopbackProbe />
    </QueryClientProvider>,
  );
}

async function openLocalRuntimesWithTheMachineOffline(parameters: BridgeParameters = {}) {
  installFakeBridge({ reachability: { verdict: 'answers', version: '0.5.1' }, ...parameters });

  onlineManager.setOnline(false);

  return render(
    <QueryClientProvider client={createQueryClient()}>
      <Suspense fallback={<p>The registry is still loading.</p>}>
        <ProvidersPage kind="local" />
      </Suspense>
      <LoopbackProbe />
    </QueryClientProvider>,
  );
}

async function press(name: string) {
  const control = page.getByRole('button', { name, exact: true });

  await expect.element(control).toBeVisible();

  control.element().focus();

  await userEvent.keyboard('{Enter}');
}

async function storedKinds() {
  const registry = await window.recompose['accounts:list']();

  return registry.ok ? registry.value.accounts.map((account) => account.kind) : undefined;
}

afterEach(() => {
  onlineManager.setOnline(true);
});

test('the detect look still reaches the runtime while the machine reports itself offline', async () => {
  const screen = await openProbeWithTheMachineOffline();

  await expect.element(screen.getByText('Detected answers')).toBeVisible();
});

test('a stored runtime still reads a standing while the machine reports itself offline', async () => {
  const screen = await openProbeWithTheMachineOffline();

  await expect.element(screen.getByText('Standing answers')).toBeVisible();
});

test('the tool report still arrives while the machine reports itself offline', async () => {
  const screen = await openProbeWithTheMachineOffline();

  await expect.element(screen.getByText('Tools Claude Code')).toBeVisible();
});

test('Add anyway still stores the runtime while the machine reports itself offline', async () => {
  await openProbeWithTheMachineOffline();

  await userEvent.click(page.getByRole('button', { name: 'Add anyway' }));

  await expect.poll(storedKinds).toEqual(['local']);
});

test('the registry list settles while the machine reports itself offline', async () => {
  const screen = await openLocalRuntimesWithTheMachineOffline();

  await expect.element(screen.getByText('Nothing connected yet')).toBeVisible();
});

test('adding Ollama while the machine reports itself offline stands its row in the list', async () => {
  const screen = await openLocalRuntimesWithTheMachineOffline();

  await expect.element(screen.getByText('Nothing connected yet')).toBeVisible();

  await press('Add anyway');

  await expect.element(screen.getByText('http://127.0.0.1:11434')).toBeVisible();
});

test('removing the runtime while the machine reports itself offline takes its row off', async () => {
  const screen = await openLocalRuntimesWithTheMachineOffline({ accounts: storedOllama });

  await expect.element(screen.getByText('http://127.0.0.1:11434')).toBeVisible();

  await press('Actions for Ollama');

  const remove = page.getByRole('menuitem', { name: 'Remove', exact: true });

  await expect.element(remove).toBeVisible();

  remove.element().focus();

  await userEvent.keyboard('{Enter}');

  await expect.element(screen.getByText('Nothing connected yet')).toBeVisible();
});
