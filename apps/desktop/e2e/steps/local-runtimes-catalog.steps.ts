import { expect } from '@playwright/test';

import { Then } from '../fixtures';
import { catalog, screenTitle } from '../provider-screen';

const ENTRIES_AND_THE_ONE_DISMISSAL = 6;

const ENTRIES_THAT_CANNOT_CONNECT_YET = 4;

Then('the catalog opens over the screen, holding five entries', async ({ page }) => {
  await expect(catalog(page)).toBeVisible();
  await expect(screenTitle(page)).toHaveText('Local Runtimes');
  await expect(catalog(page).getByRole('button')).toHaveCount(ENTRIES_AND_THE_ONE_DISMISSAL);
});

Then('the four that cannot connect yet stand under Soon badges', async ({ page }) => {
  await expect(catalog(page).getByText('Soon', { exact: true })).toHaveCount(
    ENTRIES_THAT_CANNOT_CONNECT_YET,
  );
});
