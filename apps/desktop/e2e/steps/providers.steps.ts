import type { Page } from '@playwright/test';

import { expect } from '@playwright/test';

import { Given, Then, When } from '../fixtures';
import {
  accountRows,
  catalog,
  catalogEntry,
  keyAScenarioPastes,
  keyStandsConnected,
  openCatalog,
} from '../provider-screen';
import { rememberKeyEntry } from '../scenario-memory';
import { secretsHeldInVault } from '../vault-file';

const THE_ONE_ENTRY_AND_THE_ONE_DISMISSAL = 2;

async function aKeyStandsUnder(page: Page, entry: string, name: string): Promise<void> {
  rememberKeyEntry(page, entry);
  await keyStandsConnected(page, { entry, name, pasted: keyAScenarioPastes(entry) });
}

Given('the catalog is open', async ({ page }) => {
  await openCatalog(page);
});

Given('a connected {string} key named {string}', async ({ page }, entry: string, name: string) => {
  await aKeyStandsUnder(page, entry, name);
});

When('the maintainer asks to add a provider', async ({ page }) => {
  await openCatalog(page);
});

When(
  'the maintainer connects an {string} key named {string}',
  async ({ page }, entry: string, name: string) => {
    await aKeyStandsUnder(page, entry, name);
  },
);

When('the maintainer removes the account', async ({ page }) => {
  await accountRows(page)
    .first()
    .getByRole('button', { name: /^Actions for/u })
    .click();
  await page.getByRole('menuitem', { name: 'Remove' }).click();
});

Then('only {string} answers a pick', async ({ page }, entry: string) => {
  await expect(catalogEntry(page, entry)).not.toHaveAttribute('aria-disabled');
  await expect(catalog(page).locator('button:not([aria-disabled])')).toHaveCount(
    THE_ONE_ENTRY_AND_THE_ONE_DISMISSAL,
  );
});

Then('the account connects', async ({ page }) => {
  await expect(catalog(page)).toBeHidden();
  await expect(accountRows(page).first()).toBeVisible();
});

Then('the account leaves the list', async ({ page }) => {
  await expect(accountRows(page)).toHaveCount(0);
});

Then('a sentence names what a key serves', async ({ page }) => {
  await expect(page.getByRole('main')).toContainText(
    'An API key is a secret one provider gives you',
  );
});

Then('no account list renders', async ({ page }) => {
  await expect(page.getByRole('main').getByRole('list')).toHaveCount(0);
});

Then('the vault holds nothing for the account', async ({ electronApp }) => {
  expect(await secretsHeldInVault(electronApp)).toBe(0);
});
