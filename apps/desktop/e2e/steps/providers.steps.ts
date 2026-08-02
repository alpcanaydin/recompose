import { expect } from '@playwright/test';

import { Given, Then, When } from '../fixtures';
import { connectKeyAccount } from '../provider-screen';

When('the maintainer connects an {string} api-key account', async ({ page }, provider: string) => {
  await connectKeyAccount(page, provider);
});

Given('a connected {string} api-key account', async ({ page }, provider: string) => {
  await connectKeyAccount(page, provider);
  await expect(
    page.getByRole('main').getByRole('listitem').filter({ hasText: 'Anthropic' }),
  ).toBeVisible();
});

When('the maintainer removes the {string} account', async ({ page }, label: string) => {
  await page.getByRole('button', { name: `Remove ${label}` }).click();
});

Then(
  'the providers list shows the {string} account for {string}',
  async ({ page }, label: string, provider: string) => {
    const item = page.getByRole('main').getByRole('listitem').filter({ hasText: label });

    await expect(item).toBeVisible();
    await expect(item).toContainText(provider);
    await expect(item).toContainText('api-key');
  },
);

Then('the providers list is empty', async ({ page }) => {
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(0);
});
