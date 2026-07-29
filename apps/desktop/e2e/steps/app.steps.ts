import { expect } from '@playwright/test';

import { Given, Then } from '../fixtures';

Given('the app is on the gateways screen', async ({ page }) => {
  await page.getByRole('link', { name: 'Gateways' }).click();
});

Given('the app is on the providers screen', async ({ page }) => {
  await page.getByRole('link', { name: 'Providers' }).click();
  await expect(page.getByRole('heading', { name: 'Providers' })).toBeVisible();
});

Given('the app is on the settings screen', async ({ page }) => {
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});

Then('it offers to select a gateway or create one', async ({ page }) => {
  await expect(page.getByText('Select a gateway or create one to get started.')).toBeVisible();
});
