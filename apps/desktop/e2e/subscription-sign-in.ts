import type { Page } from '@playwright/test';

import { expect } from '@playwright/test';

import type { SubscriptionTools } from './subscription-tools';

import { catalog, openProviderScreen, openProviderWays, toolBinaryFor } from './provider-screen';

/**
 * What one sign-in may spend before it says so itself.
 *
 * @summary The tool answers in about a second, and the surface waits on it rather than on a
 * keystroke. A scenario arranging a sign-in budgets above this, so the allowance can expire and
 * name what stalled rather than losing the race to a test ceiling that names only the clock.
 */
export const SIGN_IN_WAIT_MS = 20_000;

export async function signInThroughTheTool(page: Page, provider: string): Promise<void> {
  await openProviderWays(page, provider);
  await catalog(page)
    .getByRole('button', { name: `Sign in to ${provider}` })
    .click();
  await expect(catalog(page)).toBeHidden({ timeout: SIGN_IN_WAIT_MS });
}

/** Installs the provider's tool and signs in through it, leaving one connected account behind. */
export async function connectSubscription(
  page: Page,
  tools: SubscriptionTools,
  provider: string,
): Promise<void> {
  await tools.install(toolBinaryFor(provider));
  await openProviderScreen(page, 'Subscriptions');
  await signInThroughTheTool(page, provider);
}
