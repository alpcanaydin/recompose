import type { ElectronApplication, Page } from '@playwright/test';

import { expect } from '@playwright/test';

import { Given, Then, When } from '../fixtures';

/** The process each page belonged to before the theme changed, so a scenario can prove nothing restarted. */
export const processIdsBeforeThemeSwitch = new WeakMap<Page, number>();

export function processIdOf(app: ElectronApplication): number {
  const { pid } = app.process();

  if (pid === undefined) {
    throw new Error('the running app reported no process id');
  }

  return pid;
}

When('the maintainer switches the theme to dark', async ({ electronApp, page }) => {
  processIdsBeforeThemeSwitch.set(page, processIdOf(electronApp));

  await page.getByRole('radio', { name: 'Dark' }).click();
});

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

Then('the app offers {string}', async ({ page }, label: string) => {
  await expect(page.getByRole('button', { name: label })).toBeVisible();
});
