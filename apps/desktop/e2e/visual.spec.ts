import type { ElectronApplication, Page } from '@playwright/test';

import { expect } from '@playwright/test';

import { test } from './fixtures';
import { keyAScenarioPastes, keyStandsConnected, openKeysScreen } from './provider-screen';

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
  await openKeysScreen(page);
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(0);
  await settleFonts(electronApp, page);
  await expect(page).toHaveScreenshot('providers-empty.png', capture);
});

test('the providers screen matches its baseline with a connected account', async ({
  electronApp,
  page,
}) => {
  await pinLightScheme(electronApp);
  await openKeysScreen(page);
  await keyStandsConnected(page, {
    entry: 'Anthropic API',
    name: 'build',
    pasted: keyAScenarioPastes('Anthropic API'),
  });
  await settleFonts(electronApp, page);
  await expect(page).toHaveScreenshot('providers-connected.png', capture);
});

test('the settings screen matches its baseline', async ({ electronApp, page }) => {
  await pinLightScheme(electronApp);
  await openSettings(page);
  await settleFonts(electronApp, page);
  await expect(page).toHaveScreenshot('settings.png', capture);
});
