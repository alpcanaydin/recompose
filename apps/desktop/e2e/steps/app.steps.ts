import type { ElectronApplication, Page } from '@playwright/test';

import { _electron as electron, expect } from '@playwright/test';
import { join } from 'node:path';
import { createBdd } from 'playwright-bdd';

import { Given, inheritedEnv, test, Then, When } from '../fixtures';

const { After } = createBdd(test);

const appRoot = join(__dirname, '../..');

/** The process each page belonged to before the theme changed, so a scenario can prove nothing restarted. */
export const processIdsBeforeThemeSwitch = new WeakMap<Page, number>();

export type RestartedApp = {
  app: ElectronApplication;
  page: Page;
  visibleBeforeContentReady: boolean;
};

const restartedApps = new WeakMap<Page, RestartedApp>();

export function processIdOf(app: ElectronApplication): number {
  const { pid } = app.process();

  if (pid === undefined) {
    throw new Error('the running app reported no process id');
  }

  return pid;
}

export async function windowVisibility(app: ElectronApplication): Promise<boolean> {
  return app.evaluate(
    ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible() ?? false,
  );
}

/** The app a scenario restarted, which is a second process reading the first one's folder. */
export function restartedAppFor(page: Page): RestartedApp {
  const restarted = restartedApps.get(page);

  if (restarted === undefined) {
    throw new Error('the app was never restarted in this scenario');
  }

  return restarted;
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

When('the maintainer switches the theme to dark', async ({ electronApp, page }) => {
  processIdsBeforeThemeSwitch.set(page, processIdOf(electronApp));

  await page.getByRole('radio', { name: 'Dark' }).click();
});

Given('the app is on the gateways screen', async ({ page }) => {
  await expect(page.getByRole('group', { name: 'Local Gateways' })).toBeVisible();
});

Given('the app is on the providers screen', async ({ page }) => {
  await page.getByRole('link', { name: 'API Keys' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'API Keys' })).toBeVisible();
});

Given('the app is on the settings screen', async ({ page }) => {
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});

Then('the app offers {string}', async ({ page }, label: string) => {
  await expect(page.getByRole('button', { name: label })).toBeVisible();
});

When('the app restarts', async ({ electronApp, page }) => {
  const userDataDir = await electronApp.evaluate(({ app }) => app.getPath('userData'));

  restartedApps.set(page, await launchFrom(userDataDir));
});

After(async ({ page }) => {
  await restartedApps.get(page)?.app.close();
});
