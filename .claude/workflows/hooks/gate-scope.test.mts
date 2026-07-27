import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  checkoutWithStandInGate,
  configuredWorktreeOfCheckout,
  DENIAL_DECISION,
  editPayload,
  GATE_ARGUMENT_ECHO,
  GATE_CONFIGURATION_NAME,
  type HookOutcome,
  plantConfigurationIn,
  plantedRepository,
  runResolverIn,
  scratchWorkspace,
  worktreeOfCheckout,
} from './gate-harness.mts';

const IN_SCOPE_SOURCE_PATH = join('apps', 'desktop', 'src', 'main', 'index.ts');

function worktreeBesideTheCheckout(checkout: string): string {
  return configuredWorktreeOfCheckout(checkout, join(scratchWorkspace(), 'cluster-1'));
}

function worktreeNestedInTheCheckout(checkout: string): string {
  return configuredWorktreeOfCheckout(
    checkout,
    join(checkout, '.claude', 'worktrees', 'cluster-1'),
  );
}

function worktreeBelowAPlantedConfiguration(checkout: string): string {
  const overarching = plantConfigurationIn(scratchWorkspace());

  return worktreeOfCheckout(checkout, join(overarching, 'cluster-2'));
}

function editInside(root: string): string {
  return editPayload(join(root, IN_SCOPE_SOURCE_PATH));
}

function gateConfigurationArgument(outcome: HookOutcome): string | undefined {
  const gateArguments = outcome.stdout.split('\n');
  const flag = gateArguments.indexOf('--config');

  return flag === -1 ? undefined : gateArguments[flag + 1];
}

describe('the test-first gate scope: an edit inside a worktree beside the checkout', () => {
  it('hands the gate that worktree own configuration, so the edit stays in scope', () => {
    const checkout = checkoutWithStandInGate(GATE_ARGUMENT_ECHO);
    const worktree = worktreeBesideTheCheckout(checkout);

    const outcome = runResolverIn(checkout, editInside(worktree));

    assert.equal(gateConfigurationArgument(outcome), join(worktree, GATE_CONFIGURATION_NAME));
  });

  it('starts the gate from the resolver checkout, so a worktree needs no install', () => {
    const checkout = checkoutWithStandInGate(`printf '%s' '${DENIAL_DECISION}'`);
    const worktree = worktreeBesideTheCheckout(checkout);

    const outcome = runResolverIn(checkout, editInside(worktree));

    assert.equal(outcome.stdout, DENIAL_DECISION);
    assert.equal(outcome.status, 0);
  });
});

describe('the test-first gate scope: an edit inside a worktree nested under the checkout', () => {
  it('hands the gate the nested worktree own configuration', () => {
    const checkout = checkoutWithStandInGate(GATE_ARGUMENT_ECHO);
    const worktree = worktreeNestedInTheCheckout(checkout);

    const outcome = runResolverIn(checkout, editInside(worktree));

    assert.equal(gateConfigurationArgument(outcome), join(worktree, GATE_CONFIGURATION_NAME));
  });
});

describe('the test-first gate scope: an edit no gate configuration covers', () => {
  it('falls back to the resolver own checkout configuration', () => {
    const checkout = checkoutWithStandInGate(GATE_ARGUMENT_ECHO);
    const outside = join(scratchWorkspace(), 'notes', 'scratch.ts');

    const outcome = runResolverIn(checkout, editPayload(outside));

    assert.equal(gateConfigurationArgument(outcome), join(checkout, GATE_CONFIGURATION_NAME));
  });
});

describe('the test-first gate scope: an edit inside a repository that is not the checkout one', () => {
  it('refuses that repository configuration and keeps the resolver own checkout one', () => {
    const checkout = checkoutWithStandInGate(GATE_ARGUMENT_ECHO);
    const planted = plantedRepository(join(scratchWorkspace(), 'planted'));

    const outcome = runResolverIn(checkout, editInside(planted));

    assert.equal(gateConfigurationArgument(outcome), join(checkout, GATE_CONFIGURATION_NAME));
  });
});

describe('the test-first gate scope: an edit inside a worktree the configuration sits above', () => {
  it('stops climbing at the worktree root rather than reaching that configuration', () => {
    const checkout = checkoutWithStandInGate(GATE_ARGUMENT_ECHO);
    const worktree = worktreeBelowAPlantedConfiguration(checkout);

    const outcome = runResolverIn(checkout, editInside(worktree));

    assert.equal(gateConfigurationArgument(outcome), join(checkout, GATE_CONFIGURATION_NAME));
  });
});
