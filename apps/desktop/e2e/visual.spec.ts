import type { ElectronApplication, Page } from '@playwright/test';

import { expect } from '@playwright/test';

import { test } from './fixtures';

const captureWidth = 1024;
const captureHeight = 660;
const capture = { clip: { x: 0, y: 0, width: captureWidth, height: captureHeight } };

async function pinLightScheme(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ nativeTheme }) => {
    nativeTheme.themeSource = 'light';
  });
}

async function pinContentSize(app: ElectronApplication, page: Page): Promise<void> {
  await app.evaluate(
    ({ BrowserWindow }, size) => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.setContentSize(size.width, size.height);
      }
    },
    { width: captureWidth, height: captureHeight + 40 },
  );

  await expect.poll(async () => page.evaluate(() => window.innerWidth)).toBe(captureWidth);
  await expect
    .poll(async () => page.evaluate(() => window.innerHeight))
    .toBeGreaterThanOrEqual(captureHeight);
}

async function settleFonts(app: ElectronApplication, page: Page): Promise<void> {
  await pinContentSize(app, page);

  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function openProviders(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'API Keys' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'API Keys' })).toBeVisible();
}

async function openSettings(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
}

test('the home screen matches its baseline', async ({ electronApp, page }) => {
  await pinLightScheme(electronApp);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Create your first gateway' }),
  ).toBeVisible();
  await settleFonts(electronApp, page);
  await expect(page).toHaveScreenshot('home-empty.png', capture);
});

test('the providers screen matches its baseline before any account exists', async ({
  electronApp,
  page,
}) => {
  await pinLightScheme(electronApp);
  await openProviders(page);
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(0);
  await settleFonts(electronApp, page);
  await expect(page).toHaveScreenshot('providers-empty.png', capture);
});

test('the providers screen matches its baseline with a connected account', async ({
  electronApp,
  page,
}) => {
  await pinLightScheme(electronApp);
  await openProviders(page);
  await page.getByRole('textbox', { name: 'Provider' }).fill('anthropic');
  await page.getByRole('combobox', { name: 'Kind' }).selectOption('api-key');
  await page.getByRole('textbox', { name: 'Label' }).fill('Claude Max');
  await page.getByRole('textbox', { name: 'Secret' }).fill('not-a-real-secret');
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(
    page.getByRole('main').getByRole('listitem').filter({ hasText: 'Claude Max' }),
  ).toBeVisible();
  await settleFonts(electronApp, page);
  await expect(page).toHaveScreenshot('providers-connected.png', capture);
});

test('the settings screen matches its baseline', async ({ electronApp, page }) => {
  await pinLightScheme(electronApp);
  await openSettings(page);
  await settleFonts(electronApp, page);
  await expect(page).toHaveScreenshot('settings.png', capture);
});
