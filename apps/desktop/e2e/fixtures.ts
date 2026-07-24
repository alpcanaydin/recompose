import type { ElectronApplication, Page } from '@playwright/test';

import { _electron as electron } from '@playwright/test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBdd, test as base } from 'playwright-bdd';

const appRoot = join(__dirname, '..');

const launchArgs =
  process.platform === 'linux' ? [appRoot, '--password-store=gnome-libsecret'] : [appRoot];

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

export const test = base.extend<ElectronFixtures>({
  electronApp: async ({}, use) => {
    const userDataDir = await mkdtemp(join(tmpdir(), 'recompose-e2e-'));
    const app = await electron.launch({
      args: launchArgs,
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

    await use(app);
    await app.close();
  },
  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();

    await page.waitForLoadState('domcontentloaded');
    await use(page);
  },
});

export const { Given, When, Then } = createBdd(test);
