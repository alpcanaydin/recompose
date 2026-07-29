import type { ElectronApplication, Locator, Page } from '@playwright/test';
import type { SystemState } from '@recompose/contracts';

import { expect } from '@playwright/test';

import { fileBrowserFor } from '../../src/main/system/file-browser';
import { loginItemAvailabilityFor } from '../../src/main/system/login-item';
import { Given, Then, When } from '../fixtures';

const nodePlatforms: Record<string, NodeJS.Platform> = {
  macOS: 'darwin',
  Windows: 'win32',
  Linux: 'linux',
};

function dataSection(page: Page): Locator {
  return page.getByRole('group', { name: 'Data' });
}

function revealAction(page: Page): Locator {
  return dataSection(page).getByRole('button');
}

function nodePlatformFor(name: string): NodeJS.Platform {
  const platform = nodePlatforms[name];

  if (platform === undefined) {
    throw new Error(`the scenarios name no platform recompose ships on: ${name}`);
  }

  return platform;
}

async function configFolder(app: ElectronApplication): Promise<string> {
  return app.evaluate(({ app: running }) => running.getPath('userData'));
}

async function homeShorthandConfigFolder(app: ElectronApplication): Promise<string> {
  return app.evaluate(({ app: running }) => {
    const folder = running.getPath('userData');
    const home = running.getPath('home');

    return folder.startsWith(home) ? `~${folder.slice(home.length)}` : folder;
  });
}

async function openedFolder(app: ElectronApplication): Promise<string> {
  return app.evaluate(() => process.env['RECOMPOSE_E2E_OPENED_FOLDER'] ?? '');
}

async function watchFolderOpening(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ shell }) => {
    shell.openPath = async (folder: string) => {
      process.env['RECOMPOSE_E2E_OPENED_FOLDER'] = folder;

      return Promise.resolve(process.env['RECOMPOSE_E2E_FOLDER_REFUSAL'] ?? '');
    };
  });
}

Given('the app runs on {word}', async ({ electronApp, page }, platform: string) => {
  const observed = await page.evaluate(async () => window.recompose['system:get']());

  if (!observed.ok) {
    throw new Error(`the app could not report its system: ${observed.error.message}`);
  }

  const named = nodePlatformFor(platform);
  const packaged = await electronApp.evaluate(({ app }) => app.isPackaged);

  const reported: SystemState = {
    ...observed.value,
    fileBrowser: fileBrowserFor(named),
    loginItem: loginItemAvailabilityFor(named, packaged),
  };

  await electronApp.evaluate(({ ipcMain }, state) => {
    ipcMain.removeHandler('system:get');
    ipcMain.handle('system:get', () => ({ ok: true, value: state }));
  }, reported);

  await page.reload();
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
});

Given('the operating system refuses to open the config folder', async ({ electronApp }) => {
  await electronApp.evaluate(() => {
    process.env['RECOMPOSE_E2E_FOLDER_REFUSAL'] = 'the folder is no longer there';
  });
});

When('the maintainer reveals the config folder', async ({ electronApp, page }) => {
  await watchFolderOpening(electronApp);

  await revealAction(page).click();
});

Then(
  'the config folder row shows the folder that holds the settings document',
  async ({ electronApp, page }) => {
    const folder = await homeShorthandConfigFolder(electronApp);

    await expect(dataSection(page).getByText(folder)).toBeVisible();
  },
);

Then('the config folder row offers {string}', async ({ page }, label: string) => {
  await expect(revealAction(page)).toHaveAccessibleName(label);
});

Then('the operating system opens the folder that holds recompose data', async ({ electronApp }) => {
  const folder = await configFolder(electronApp);

  await expect.poll(async () => openedFolder(electronApp)).toBe(folder);
});

Then('the row states that the folder did not open', async ({ page }) => {
  await expect(dataSection(page).getByRole('alert')).toHaveText('The folder did not open.');
});
