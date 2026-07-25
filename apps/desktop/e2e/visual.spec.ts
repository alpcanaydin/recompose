import type { Page } from '@playwright/test';

import { expect } from '@playwright/test';

import { test } from './fixtures';

async function settleFonts(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function openProviders(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Providers' }).click();
  await expect(page.getByRole('heading', { name: 'Providers' })).toBeVisible();
}

test('the home screen matches its baseline', async ({ page }) => {
  await expect(page.getByText('Select a gateway or create one to get started.')).toBeVisible();
  await settleFonts(page);
  await expect(page).toHaveScreenshot('home-empty.png');
});

test('the providers screen matches its baseline before any account exists', async ({ page }) => {
  await openProviders(page);
  await expect(page.getByRole('listitem')).toHaveCount(0);
  await settleFonts(page);
  await expect(page).toHaveScreenshot('providers-empty.png');
});

test('the providers screen matches its baseline with a connected account', async ({ page }) => {
  await openProviders(page);
  await page.getByRole('textbox', { name: 'Provider' }).fill('anthropic');
  await page.getByRole('combobox', { name: 'Kind' }).selectOption('api-key');
  await page.getByRole('textbox', { name: 'Label' }).fill('Claude Max');
  await page.getByRole('textbox', { name: 'Secret' }).fill('not-a-real-secret');
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Claude Max' })).toBeVisible();
  await settleFonts(page);
  await expect(page).toHaveScreenshot('providers-connected.png');
});
