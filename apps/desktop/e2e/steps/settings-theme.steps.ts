import type { ElectronApplication, Page } from '@playwright/test';

import { _electron as electron, expect } from '@playwright/test';
import { join } from 'node:path';
import { createBdd } from 'playwright-bdd';

import { Given, inheritedEnv, test, Then, When } from '../fixtures';

const { After } = createBdd(test);

const appRoot = join(__dirname, '../..');

type PaintedScheme = 'dark' | 'light';

type ThemeReading = { source: 'dark' | 'light' | 'system'; usesDarkColors: boolean };

type RestartedApp = { app: ElectronApplication; page: Page; visibleBeforeContentReady: boolean };

const restartedApps = new WeakMap<Page, RestartedApp>();

const processIdsBeforeSwitch = new WeakMap<Page, number>();

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

function processIdOf(app: ElectronApplication): number {
  const { pid } = app.process();

  if (pid === undefined) {
    throw new Error('the running app reported no process id');
  }

  return pid;
}

function restartedAppFor(page: Page): RestartedApp {
  const restarted = restartedApps.get(page);

  if (restarted === undefined) {
    throw new Error('the app was never restarted in this scenario');
  }

  return restarted;
}

async function windowVisibility(app: ElectronApplication): Promise<boolean> {
  return app.evaluate(
    ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible() ?? false,
  );
}

async function launchFrom(userDataDir: string): Promise<RestartedApp> {
  const app = await electron.launch({
    args: [appRoot],
    colorScheme: null,
    env: {
      ...inheritedEnv(),
      NODE_ENV: 'production',
      ELECTRON_RENDERER_URL: '',
      RECOMPOSE_USER_DATA_DIR: userDataDir,
    },
  });

  const page = await app.firstWindow();
  const visibleBeforeContentReady = await windowVisibility(app);

  await page.waitForLoadState('domcontentloaded');

  return { app, page, visibleBeforeContentReady };
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

When('the maintainer switches the theme to dark', async ({ electronApp, page }) => {
  processIdsBeforeSwitch.set(page, processIdOf(electronApp));

  await chooseDarkTheme(page);
});

Then('the app repaints in dark without a restart', async ({ electronApp, page }) => {
  await expectDarkThroughout(electronApp, page);

  expect(processIdOf(electronApp)).toBe(processIdsBeforeSwitch.get(page));
});

Given('the maintainer switched the theme to dark', async ({ electronApp, page }) => {
  await chooseDarkTheme(page);

  await expect
    .poll(async () => themeReading(electronApp))
    .toEqual({ source: 'dark', usesDarkColors: true });
});

When('the app restarts', async ({ electronApp, page }) => {
  const userDataDir = await electronApp.evaluate(({ app }) => app.getPath('userData'));

  restartedApps.set(page, await launchFrom(userDataDir));
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

After(async ({ page }) => {
  await restartedApps.get(page)?.app.close();
});
