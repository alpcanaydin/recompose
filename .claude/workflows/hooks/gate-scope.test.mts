import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  aliasedCheckout,
  checkoutWithArmedGate,
  checkoutWithStandInGate,
  configuredWorktreeOfCheckout,
  directoryClaimingCheckout,
  editPayload,
  GATE_ARGUMENT_ECHO,
  GATE_CONFIGURATION_NAME,
  GATE_RULE_REASON,
  guardedNotebookPayload,
  guardedWritePayload,
  type HookOutcome,
  plantedRepository,
  runResolverIn,
  scratchWorkspace,
} from './gate-harness.mts';

const IN_SCOPE_SOURCE_PATH = join('apps', 'desktop', 'src', 'main', 'index.ts');

const IN_SCOPE_NOTEBOOK_PATH = join('apps', 'desktop', 'src', 'main', 'exploration.ipynb');

const GATE_DENIAL = {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: `Probity: ${GATE_RULE_REASON}`,
  },
};

function editInside(root: string): string {
  return editPayload(join(root, IN_SCOPE_SOURCE_PATH));
}

function gateConfigurationArgument(outcome: HookOutcome): string | undefined {
  const gateArguments = outcome.stdout.split('\n');
  const flag = gateArguments.indexOf('--config');

  return flag === -1 ? undefined : gateArguments[flag + 1];
}

function ownConfigurationOf(checkout: string): string {
  return join(checkout, GATE_CONFIGURATION_NAME);
}

describe('the test-first gate scope: an edit inside the checkout holding the resolver', () => {
  it('hands the gate that checkout own configuration', () => {
    const checkout = checkoutWithStandInGate(GATE_ARGUMENT_ECHO);

    const outcome = runResolverIn(checkout, editInside(checkout));

    assert.equal(gateConfigurationArgument(outcome), ownConfigurationOf(checkout));
  });
});

describe('the test-first gate scope: an edit inside a worktree beside the checkout', () => {
  it('keeps the resolver own checkout configuration rather than that worktree one', () => {
    const checkout = checkoutWithStandInGate(GATE_ARGUMENT_ECHO);
    const worktree = configuredWorktreeOfCheckout(checkout, join(scratchWorkspace(), 'cluster-1'));

    const outcome = runResolverIn(checkout, editInside(worktree));

    assert.equal(gateConfigurationArgument(outcome), ownConfigurationOf(checkout));
  });
});

describe('the test-first gate scope: an edit inside a directory claiming the checkout', () => {
  it('refuses the configuration that claim carries', () => {
    const checkout = checkoutWithStandInGate(GATE_ARGUMENT_ECHO);
    const claiming = directoryClaimingCheckout(checkout, join(scratchWorkspace(), 'claiming'));

    const outcome = runResolverIn(checkout, editInside(claiming));

    assert.equal(gateConfigurationArgument(outcome), ownConfigurationOf(checkout));
  });
});

describe('the test-first gate scope: an edit inside a repository that is not the checkout one', () => {
  it('refuses that repository configuration', () => {
    const checkout = checkoutWithStandInGate(GATE_ARGUMENT_ECHO);
    const planted = plantedRepository(join(scratchWorkspace(), 'planted'));

    const outcome = runResolverIn(checkout, editInside(planted));

    assert.equal(gateConfigurationArgument(outcome), ownConfigurationOf(checkout));
  });
});

describe('the test-first gate scope: an in-checkout edit named through a symlinked prefix', () => {
  it('denies it under the checkout own rule rather than letting it pass unjudged', () => {
    const checkout = checkoutWithArmedGate();
    const alias = aliasedCheckout(checkout);

    const outcome = runResolverIn(
      checkout,
      guardedWritePayload(alias, join(alias, IN_SCOPE_SOURCE_PATH)),
    );

    assert.deepEqual(JSON.parse(outcome.stdout), GATE_DENIAL);
  });
});

describe('the test-first gate scope: an in-checkout notebook named through a symlinked prefix', () => {
  it('denies it under the checkout own rule rather than letting it pass unjudged', () => {
    const checkout = checkoutWithArmedGate();
    const alias = aliasedCheckout(checkout);

    const outcome = runResolverIn(
      checkout,
      guardedNotebookPayload(alias, join(alias, IN_SCOPE_NOTEBOOK_PATH)),
    );

    assert.deepEqual(JSON.parse(outcome.stdout), GATE_DENIAL);
  });
});

describe('the test-first gate scope: an edit no gate configuration covers', () => {
  it('keeps the resolver own checkout configuration', () => {
    const outside = join(scratchWorkspace(), 'notes', 'scratch.ts');
    const checkout = checkoutWithStandInGate(GATE_ARGUMENT_ECHO);

    const outcome = runResolverIn(checkout, editPayload(outside));

    assert.equal(gateConfigurationArgument(outcome), ownConfigurationOf(checkout));
  });
});
