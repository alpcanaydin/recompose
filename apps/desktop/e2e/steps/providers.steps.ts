import { expect } from '@playwright/test';

import { Given, Then, When } from '../fixtures';

async function connectAccount(
  page: import('@playwright/test').Page,
  provider: string,
  label: string,
): Promise<void> {
  await page.getByRole('textbox', { name: 'Provider' }).fill(provider);
  await page.getByRole('combobox', { name: 'Kind' }).selectOption('api-key');
  await page.getByRole('textbox', { name: 'Label' }).fill(label);
  await page.getByRole('textbox', { name: 'Secret' }).fill('not-a-real-secret');
  await page.getByRole('button', { name: 'Connect' }).click();
}

When(
  'the maintainer connects an {string} api-key account labeled {string}',
  async ({ page }, provider: string, label: string) => {
    await connectAccount(page, provider, label);
  },
);

Given(
  'a connected {string} api-key account labeled {string}',
  async ({ page }, provider: string, label: string) => {
    await connectAccount(page, provider, label);
    await expect(page.getByRole('listitem').filter({ hasText: label })).toBeVisible();
  },
);

When('the maintainer removes the {string} account', async ({ page }, label: string) => {
  await page.getByRole('button', { name: `Remove ${label}` }).click();
});

Then(
  'the providers list shows the {string} account for {string}',
  async ({ page }, label: string, provider: string) => {
    const item = page.getByRole('listitem').filter({ hasText: label });

    await expect(item).toBeVisible();
    await expect(item).toContainText(provider);
    await expect(item).toContainText('api-key');
  },
);

Then('the providers list is empty', async ({ page }) => {
  await expect(page.getByRole('listitem')).toHaveCount(0);
});
