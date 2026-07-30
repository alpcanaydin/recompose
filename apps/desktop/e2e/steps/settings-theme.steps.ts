import type { ElectronApplication, Page } from '@playwright/test';

import { expect } from '@playwright/test';

import { Given, Then } from '../fixtures';
import {
  processIdOf,
  processIdsBeforeThemeSwitch,
  restartedAppFor,
  windowVisibility,
} from './app.steps';

type PaintedScheme = 'dark' | 'light';

type ThemeReading = { source: 'dark' | 'light' | 'system'; usesDarkColors: boolean };

async function paintedScheme(page: Page): Promise<PaintedScheme> {
  return page.evaluate(() =>
    matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );
}

async function themeReading(app: ElectronApplication): Promise<ThemeReading> {
  return app.evaluate(({ nativeTheme }) => ({
    source: nativeTheme.themeSource,
    usesDarkColors: nativeTheme.shouldUseDarkColors,
  }));
}

async function chooseDarkTheme(page: Page): Promise<void> {
  await page.getByRole('radio', { name: 'Dark' }).click();
}

async function expectDarkThroughout(app: ElectronApplication, page: Page): Promise<void> {
  await expect
    .poll(async () => themeReading(app))
    .toEqual({ source: 'dark', usesDarkColors: true });

  await expect.poll(async () => paintedScheme(page)).toBe('dark');
}

Then('the app repaints in dark without a restart', async ({ electronApp, page }) => {
  await expectDarkThroughout(electronApp, page);

  expect(processIdOf(electronApp)).toBe(processIdsBeforeThemeSwitch.get(page));
});

Given('the maintainer switched the theme to dark', async ({ electronApp, page }) => {
  await chooseDarkTheme(page);

  await expect
    .poll(async () => themeReading(electronApp))
    .toEqual({ source: 'dark', usesDarkColors: true });
});

Then('the app opens in dark', async ({ page }) => {
  const restarted = restartedAppFor(page);

  await expectDarkThroughout(restarted.app, restarted.page);
});

Then('it never paints light first', async ({ page }) => {
  const restarted = restartedAppFor(page);

  expect(restarted.visibleBeforeContentReady).toBe(false);

  await expect.poll(async () => windowVisibility(restarted.app)).toBe(true);
  await expect.poll(async () => paintedScheme(restarted.page)).toBe('dark');
});
