import type { Page } from '@playwright/test';

import { expect } from '@playwright/test';

import { Then, When } from '../fixtures';
import { accountRows, catalog, pickEntry, screenTitle } from '../provider-screen';

/** Picks a runtime and settles the sheet with the act its reading offered. */
async function runtimeStandsStored(page: Page, runtime: string, act: string): Promise<void> {
  await pickEntry(page, runtime);
  await catalog(page).getByRole('button', { name: act }).click();
  await expect(catalog(page)).toBeHidden();
}

When('the maintainer adds {string} from the catalog', async ({ page }, runtime: string) => {
  await runtimeStandsStored(page, runtime, `Add ${runtime}`);
});

When('the maintainer adds {string} anyway', async ({ page }, runtime: string) => {
  await runtimeStandsStored(page, runtime, 'Add anyway');
});

Then('the account lists under the Local Runtimes surface', async ({ page }) => {
  await expect(screenTitle(page)).toHaveText('Local Runtimes');
  await expect(accountRows(page)).toHaveCount(1);
});
