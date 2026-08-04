import { expect } from '@playwright/test';

import { Then, When } from '../fixtures';
import {
  accountRows,
  runtimeStandsAdded,
  runtimeStandsAddedAnyway,
  screenTitle,
} from '../provider-screen';

When('the maintainer adds {string} from the catalog', async ({ page }, runtime: string) => {
  await runtimeStandsAdded(page, runtime);
});

When('the maintainer adds {string} anyway', async ({ page }, runtime: string) => {
  await runtimeStandsAddedAnyway(page, runtime);
});

Then('the account lists under the Local Runtimes surface', async ({ page }) => {
  await expect(screenTitle(page)).toHaveText('Local Runtimes');
  await expect(accountRows(page)).toHaveCount(1);
});
