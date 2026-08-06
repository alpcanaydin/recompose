import type { Page } from '@playwright/test';
import type { VirtualModel } from '@recompose/contracts';

import { expect } from '@playwright/test';

import { Given, Then, When } from '../fixtures';
import { defineFlow, offeredKind, openDefineFlow, targetOption } from '../gateway-drawer';
import { focusedGateway } from '../scenario-memory';
import {
  accountHeldAs,
  AGGREGATOR_ACCOUNT,
  everyOfferedKindStandsStored,
  gatewayTargetingAKey,
  KEY_ACCOUNT,
  LOCAL_RUNTIME,
} from '../stored-target-accounts';
import { bindingOf, offerVirtualModels, type StoreOutcome } from '../stored-virtual-models';
import { connectSubscription, SIGN_IN_WAIT_MS } from './subscriptions.steps';

const SUBSCRIPTION_PROVIDER = 'anthropic';

/** The address the provider's own tool reports having signed in as. */
const SIGNED_IN_AS = 'dev@example.com';

/** What one stored-account flow may spend on a runner already bringing up two applications. */
const ONE_FLOW_MS = 10_000;

/**
 * What an arrangement walking a sign-in and some flows beside it may spend.
 *
 * @summary The default ceiling is sized for a scenario that arranges one thing, and this file
 * arranges up to five. Two applications launch at once by design, so a loaded runner stretches
 * every flow at once rather than one of them. The budget is derived from what the arrangement
 * contains rather than raised until the arithmetic works: the sign-in's own allowance, which is
 * the only wait long enough to decide the outcome, plus room for each flow standing beside it. A
 * ceiling below that sum would always fire first and report nothing a person could act on.
 */
function budgetFor(flowsBesideTheSignIn: number): number {
  return SIGN_IN_WAIT_MS + flowsBesideTheSignIn * ONE_FLOW_MS;
}

/** The gateway seed, the key, the aggregator, and the local runtime. */
const FLOWS_BESIDE_THE_FOUR_KIND_SIGN_IN = 4;

/** The gateway seed and the key. */
const FLOWS_BESIDE_THE_STORED_DEFINITION_SIGN_IN = 2;

/** The key, the aggregator, and the local runtime, and nothing else the picker may offer. */
const KINDS_THE_PICKER_OFFERS = 3;

const definitions = new WeakMap<Page, VirtualModel[]>();

const outcomes = new WeakMap<Page, StoreOutcome>();

function definitionHeld(page: Page): VirtualModel[] {
  const held = definitions.get(page);

  if (held === undefined) {
    throw new Error('no step wrote the definition this scenario is about');
  }

  return held;
}

function refusalOffered(page: Page): string {
  const outcome = outcomes.get(page);

  if (outcome === undefined) {
    throw new Error('no step offered a definition this scenario could read an answer from');
  }

  if (outcome.ok) {
    throw new Error('the definition landed where the scenario expected a refusal');
  }

  return outcome.message;
}

Given(
  'a gateway and a stored subscription, key, aggregator, and local account',
  async ({ $testInfo, page, subscriptionTools }) => {
    $testInfo.setTimeout(budgetFor(FLOWS_BESIDE_THE_FOUR_KIND_SIGN_IN));
    await gatewayTargetingAKey(page);
    await connectSubscription(page, subscriptionTools, SUBSCRIPTION_PROVIDER);
    await everyOfferedKindStandsStored(page);
  },
);

Given(
  'a stored virtual model {string} whose target names a subscription account',
  async ({ $testInfo, page, subscriptionTools }, name: string) => {
    $testInfo.setTimeout(budgetFor(FLOWS_BESIDE_THE_STORED_DEFINITION_SIGN_IN));
    await gatewayTargetingAKey(page);
    await connectSubscription(page, subscriptionTools, SUBSCRIPTION_PROVIDER);

    const plan = await accountHeldAs(page, 'subscription');

    definitions.set(page, [bindingOf(name, plan.id, 'claude-sonnet-5')]);
  },
);

When('the person opens the target picker for a new virtual model', async ({ page }) => {
  await openDefineFlow(page, focusedGateway(page));
});

When('the gateway config loads', async ({ page }) => {
  outcomes.set(page, await offerVirtualModels(page, focusedGateway(page), definitionHeld(page)));
});

Then('the picker lists the key, the aggregator, and the local account', async ({ page }) => {
  await expect(offeredKind(page, 'API Keys')).toBeVisible();
  await expect(offeredKind(page, 'Aggregators')).toBeVisible();
  await expect(offeredKind(page, 'Local Runtimes')).toBeVisible();
  await expect(targetOption(page, KEY_ACCOUNT)).toBeVisible();
  await expect(targetOption(page, AGGREGATOR_ACCOUNT)).toBeVisible();
  await expect(targetOption(page, LOCAL_RUNTIME)).toBeVisible();
});

Then('no subscription account stands anywhere in it', async ({ page }) => {
  await expect(offeredKind(page, 'Subscriptions')).toHaveCount(0);
  await expect(defineFlow(page).getByText(SIGNED_IN_AS)).toHaveCount(0);
  await expect(defineFlow(page).getByRole('listitem')).toHaveCount(KINDS_THE_PICKER_OFFERS);
});

Then('the config refuses the definition', ({ page }) => {
  expect(refusalOffered(page)).not.toBe('');
});

Then('names the subscription target as the reason', async ({ page }) => {
  const plan = await accountHeldAs(page, 'subscription');

  expect(refusalOffered(page)).toContain('subscription');
  expect(refusalOffered(page)).toContain(plan.label);
});
