import type { ElectronApplication, Page } from '@playwright/test';

import { _electron as electron } from '@playwright/test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBdd, test as base } from 'playwright-bdd';

const appRoot = join(__dirname, '..');

export function inheritedEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}

type ElectronFixtures = {
  electronApp: ElectronApplication;
  page: Page;
};

function platformHoldsLoginItem(): boolean {
  return process.platform === 'darwin' || process.platform === 'win32';
}

async function readLoginItem(app: ElectronApplication): Promise<boolean | null> {
  if (!platformHoldsLoginItem()) {
    return null;
  }

  return app.evaluate(
    ({ app: runningApp }) =>
      runningApp.getLoginItemSettings({ path: process.execPath, args: [] }).openAtLogin,
  );
}

async function restoreLoginItem(
  app: ElectronApplication,
  openAtLogin: boolean | null,
): Promise<void> {
  if (openAtLogin === null) {
    return;
  }

  await app.evaluate(({ app: runningApp }, enabled) => {
    runningApp.setLoginItemSettings({ path: process.execPath, args: [], openAtLogin: enabled });
  }, openAtLogin);
}

export const test = base.extend<ElectronFixtures>({
  electronApp: async ({}, use) => {
    const userDataDir = await mkdtemp(join(tmpdir(), 'recompose-e2e-'));
    const app = await electron.launch({
      args: [appRoot],
      env: {
        ...inheritedEnv(),
        NODE_ENV: 'production',
        ELECTRON_RENDERER_URL: '',
        RECOMPOSE_USER_DATA_DIR: userDataDir,
      },
    });

    app.process().stderr?.on('data', (chunk: Buffer) => {
      process.stderr.write(chunk);
    });

    const priorLoginItem = await readLoginItem(app);

    try {
      await use(app);
    } finally {
      await restoreLoginItem(app, priorLoginItem);
      await app.close();
    }
  },
  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();

    await page.waitForLoadState('domcontentloaded');
    await use(page);
  },
});

export const { Given, When, Then } = createBdd(test);
