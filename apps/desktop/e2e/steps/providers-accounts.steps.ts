import { expect } from '@playwright/test';

import { Then } from '../fixtures';
import { accountRows } from '../provider-screen';

Then(
  'the list holds one key, named {string} under {string}',
  async ({ page }, name: string, product: string) => {
    const row = accountRows(page).first();

    await expect(accountRows(page)).toHaveCount(1);
    await expect(row).toContainText(product);
    await expect(row).toContainText(name);
  },
);
