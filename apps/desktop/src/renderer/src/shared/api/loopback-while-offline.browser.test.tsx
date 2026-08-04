import type { RuntimeReachability, SubscriptionTool } from '@recompose/contracts';

import { onlineManager, QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { afterEach, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';

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

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LoopbackProbe />
    </QueryClientProvider>,
  );
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
