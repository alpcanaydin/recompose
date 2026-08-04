import { expect } from '@playwright/test';

import { Then } from '../fixtures';
import { accountRows } from '../provider-screen';

Then('no Verify act stands anywhere on or behind the row', async ({ page }) => {
  const row = accountRows(page).first();

  await expect(row.getByRole('button', { name: 'Verify' })).toHaveCount(0);
  await row.getByRole('button', { name: /^Actions for/u }).click();
  await expect(page.getByRole('menuitem', { name: 'Remove' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Verify' })).toHaveCount(0);
});
