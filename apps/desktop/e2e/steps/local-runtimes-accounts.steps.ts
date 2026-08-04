import type { Page } from '@playwright/test';

import { expect } from '@playwright/test';

import { Given, Then, When } from '../fixtures';
import {
  accountRows,
  openProviderScreen,
  placementOf,
  rowLine,
  runtimeStandsAdded,
} from '../provider-screen';
import { focusedProvider, focusProvider } from '../scenario-memory';

async function addressStandsBeneathTheName(page: Page, address: string): Promise<void> {
  const row = accountRows(page).first();
  const printed = rowLine(row, address);

  await expect(printed).toBeVisible();

  const name = await placementOf(rowLine(row, focusedProvider(page)));

  expect((await placementOf(printed)).centerY).toBeGreaterThan(name.centerY);
}

Given('a stored {string} account whose server answers', async ({ page }, runtime: string) => {
  focusProvider(page, runtime);
  await runtimeStandsAdded(page, runtime);
});

Given(
  'a stored {string} account whose server has stopped',
  async ({ localRuntime, page }, runtime: string) => {
    focusProvider(page, runtime);
    await runtimeStandsAdded(page, runtime);
    await localRuntime.fallsSilent();
  },
);

Given(
  'a stored {string} account whose port another server answers',
  async ({ localRuntime, page }, runtime: string) => {
    focusProvider(page, runtime);
    await runtimeStandsAdded(page, runtime);
    await localRuntime.answersAsAStranger();
  },
);

When('the surface lists it', async ({ page }) => {
  await openProviderScreen(page, 'API Keys');
  await openProviderScreen(page, 'Local Runtimes');
});

Then("the row's second line reads {string}", async ({ page }, address: string) => {
  await addressStandsBeneathTheName(page, address);
});

Then("the row's second line still reads {string}", async ({ page }, address: string) => {
  await addressStandsBeneathTheName(page, address);
});

Then(
  'the standing reads {string} rather than {string}',
  async ({ page }, word: string, instead: string) => {
    const row = accountRows(page).first();

    await expect(row.getByText(word, { exact: true })).toBeVisible();
    await expect(row.getByText(instead, { exact: true })).toHaveCount(0);
  },
);
