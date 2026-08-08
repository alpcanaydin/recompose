import { expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { Given, Then, When } from '../fixtures';
import {
  accountRow,
  accountRows,
  activeToolHome,
  catalog,
  openProviderScreen,
  openProviderWays,
  planCard,
  screenTitle,
  toolBinaryFor,
  toolHomesFolder,
  toolNameFor,
} from '../provider-screen';
import { focusedProvider, focusProvider } from '../scenario-memory';
import { connectSubscription, signInThroughTheTool } from '../subscription-sign-in';

Given(
  'the {string} command-line tool is installed',
  async ({ subscriptionTools }, provider: string) => {
    await subscriptionTools.install(toolBinaryFor(provider));
  },
);

Given(
  "the {string} command-line tool isn't installed",
  async ({ subscriptionTools }, provider: string) => {
    await subscriptionTools.uninstall(toolBinaryFor(provider));
  },
);

Given(
  'a connected {string} subscription',
  async ({ page, subscriptionTools }, provider: string) => {
    await connectSubscription(page, subscriptionTools, provider);
  },
);

Given(
  'a connected {string} subscription signed in as {string} on the {string} plan',
  async ({ page, subscriptionTools }, provider: string, address: string, plan: string) => {
    await connectSubscription(page, subscriptionTools, provider);
    await expect(accountRow(page, address)).toContainText(plan);
  },
);

Given(
  'a connected {string} subscription whose authorization lapsed',
  async ({ electronApp, page, subscriptionTools }, provider: string) => {
    await connectSubscription(page, subscriptionTools, provider);

    const home = await activeToolHome(electronApp, provider);

    await subscriptionTools.revokeKeptCredentials();
    await rm(join(home, '.credentials.json'), { force: true });
    await page.reload();
    await openProviderScreen(page, 'Subscriptions');
  },
);

When('the maintainer picks {string}', async ({ page }, provider: string) => {
  focusProvider(page, provider);
  await openProviderWays(page, provider);
});

When(
  'the maintainer connects an {string} subscription by signing in',
  async ({ page }, provider: string) => {
    await signInThroughTheTool(page, provider);
  },
);

When('the maintainer chooses to sign in to {string}', async ({ page }, provider: string) => {
  focusProvider(page, provider);
  await openProviderWays(page, provider);
});

Then('the catalog opens over the screen, holding only subscription plans', async ({ page }) => {
  await expect(catalog(page)).toBeVisible();
  await expect(screenTitle(page)).toHaveText('Subscriptions');
  await expect(planCard(page, 'anthropic')).toBeVisible();
  await expect(planCard(page, 'openai')).toBeVisible();
  await expect(catalog(page).getByRole('button', { name: /OpenRouter/u })).toBeHidden();
});

Then('the plans that cannot connect yet stand disabled', async ({ page }) => {
  await expect(catalog(page).getByRole('button', { name: /GitHub Copilot/u })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
});

Then(
  "the sign-in stands alone, yielding an account for the provider's own tool",
  async ({ page }) => {
    const yields = `An account for ${toolNameFor(focusedProvider(page))}`;

    await expect(catalog(page).getByRole('heading', { name: yields })).toBeVisible();
    await expect(catalog(page).getByLabel('Key', { exact: true })).toBeHidden();
  },
);

Then('the subscriptions catalog offers no key field', async ({ page }) => {
  await openProviderWays(page, 'anthropic');
  await expect(catalog(page).getByLabel('Key', { exact: true })).toBeHidden();
});

Then('the screen offers one call to action', async ({ page }) => {
  const controls = page.getByRole('main').getByRole('button', { disabled: false });

  await expect(controls).toHaveCount(1);
  await expect(controls).toHaveAccessibleName('Add provider');
});

Then('a sentence names what a subscription account is', async ({ page }) => {
  await expect(page.getByRole('main')).toContainText(
    'A subscription account is a plan you already pay for',
  );
});

Then(
  "the row carries the provider's mark, the product name, the {string} plan, and {string}",
  async ({ page }, plan: string, address: string) => {
    const row = accountRow(page, address);

    await expect(row).toContainText('Claude');
    await expect(row).toContainText(plan);
    await expect(row).toContainText(address);
    await expect(row.locator('svg[aria-hidden="true"]').first()).toBeAttached();
  },
);

Then('the standing reads {string} with a mark beside the word', async ({ page }, word: string) => {
  const standing = accountRows(page).first().getByText(word, { exact: true });

  await expect(standing).toBeVisible();
  await expect(standing.locator('span[aria-hidden="true"]')).toBeAttached();
});

Then('the row reports the lapse rather than {string}', async ({ page }, connected: string) => {
  await expect(accountRows(page).first()).toContainText('Signed out');
  await expect(accountRows(page).first()).not.toContainText(connected);
});

Then('the row itself offers the way to restore the account', async ({ page }) => {
  await expect(
    accountRows(page).first().getByRole('button', { name: 'Sign in again' }),
  ).toBeVisible();
});

Then('the screen lists one subscription account', async ({ page }) => {
  await expect(accountRows(page)).toHaveCount(1);
});

Then('the row names the plan product the account signs into', async ({ page }) => {
  await expect(accountRows(page).first()).toContainText('Claude');
  await expect(accountRows(page).first()).not.toContainText('Serves');
});

Then('nothing on the screen offers the account as a gateway target', async ({ page }) => {
  const surface = page.getByRole('main');

  await expect(surface).not.toContainText('gateway', { ignoreCase: true });
  await expect(surface).not.toContainText('target', { ignoreCase: true });
});

Then("the app hands the sign-in to the provider's own tool", async ({ electronApp }) => {
  const home = await activeToolHome(electronApp, 'anthropic');
  const record: unknown = JSON.parse(await readFile(join(home, '.claude.json'), 'utf8'));

  expect(JSON.stringify(record)).toContain('dev@example.com');
});

Then('the account appears once that tool reports success', async ({ page }) => {
  await expect(accountRows(page)).toHaveCount(1);
  await expect(accountRows(page).first()).toContainText('dev@example.com');
});

Then('the surface names the missing tool and what to do about it', async ({ page }) => {
  const provider = focusedProvider(page);

  await expect(catalog(page)).toContainText(
    `${toolNameFor(provider)} isn't installed. Install it, then sign in from here.`,
  );
  await expect(
    catalog(page).getByRole('button', { name: `Sign in to ${provider}` }),
  ).toBeDisabled();
});

Then('no sign-in begins', async ({ electronApp }) => {
  expect(existsSync(await toolHomesFolder(electronApp, 'anthropic'))).toBe(false);
});
