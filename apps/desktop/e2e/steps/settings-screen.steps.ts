import type { ElectronApplication, Locator, Page } from '@playwright/test';
import type { Settings } from '@recompose/contracts';

import { expect } from '@playwright/test';
import { defaultSettings, loadSettings } from '@recompose/contracts';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { Given, Then, When } from '../fixtures';

const sectionHeadings = ['General', 'Server', 'Appearance', 'Data'];

function settingsScreen(page: Page): Locator {
  return page.getByRole('main');
}

function section(page: Page, heading: string): Locator {
  return page.getByRole('group', { name: heading });
}

function themeChoice(page: Page, label: string): Locator {
  return section(page, 'Appearance')
    .getByRole('radiogroup', { name: 'Theme' })
    .getByRole('radio', { name: label });
}

async function userDataPath(electronApp: ElectronApplication): Promise<string> {
  return electronApp.evaluate(({ app }) => app.getPath('userData'));
}

function isMissingFile(failure: unknown): boolean {
  return failure instanceof Error && 'code' in failure && failure.code === 'ENOENT';
}

async function storedThemeAndPort(
  settingsFile: string,
): Promise<Pick<Settings, 'enginePort' | 'theme'>> {
  const document = await readFile(settingsFile, 'utf8').catch((failure: unknown) => {
    if (isMissingFile(failure)) {
      return null;
    }

    throw failure;
  });

  if (document === null) {
    const { enginePort, theme } = defaultSettings();

    return { enginePort, theme };
  }

  const stored: unknown = JSON.parse(document);
  const { enginePort, theme } = loadSettings(stored);

  return { enginePort, theme };
}

Given('the settings document cannot be written', async ({ electronApp }) => {
  const settingsFile = join(await userDataPath(electronApp), 'settings.json');

  await rm(settingsFile, { force: true, recursive: true });
  await mkdir(settingsFile);
});

When('commits port {int} straight after', async ({ page }, port: number) => {
  const field = section(page, 'Server').getByRole('textbox', { name: 'Port' });

  await field.fill(String(port));
  await field.press('Enter');
});

Then(
  'the screen groups its settings under General, Server, Appearance, and Data in that order',
  async ({ page }) => {
    await expect(settingsScreen(page).getByRole('group')).toHaveCount(sectionHeadings.length);
    await expect(settingsScreen(page).getByRole('heading', { level: 2 })).toHaveText(
      sectionHeadings,
    );
  },
);

Then('the app repaints in dark', async ({ electronApp }) => {
  await expect
    .poll(async () =>
      electronApp.evaluate(({ nativeTheme }) => ({
        chosen: nativeTheme.themeSource,
        painting: nativeTheme.shouldUseDarkColors,
      })),
    )
    .toEqual({ chosen: 'dark', painting: true });
});

Then('the screen offers no save, apply, or cancel action', async ({ page }) => {
  await expect(
    settingsScreen(page).getByRole('button', { name: /save|apply|cancel/i }),
  ).toHaveCount(0);
});

Then('focus stays on the theme control', async ({ page }) => {
  await expect(themeChoice(page, 'Dark')).toBeFocused();
});

Then('the app neither navigates nor opens a window', async ({ electronApp, page }) => {
  await expect(page).toHaveURL(/#\/settings$/);
  expect(electronApp.windows()).toHaveLength(1);
});

Then('the theme returns to system', async ({ page }) => {
  await expect(themeChoice(page, 'System')).toBeChecked();
});

Then('the row states that the change was not saved', async ({ page }) => {
  await expect(section(page, 'Appearance').getByRole('alert')).toHaveText(
    'The change was not saved.',
  );
});

Then(
  'the stored settings hold the dark theme and port {int}',
  async ({ electronApp }, port: number) => {
    const settingsFile = join(await userDataPath(electronApp), 'settings.json');

    await expect
      .poll(async () => storedThemeAndPort(settingsFile))
      .toEqual({ enginePort: port, theme: 'dark' });
  },
);

Then('the telemetry row reads {string}', async ({ page }, value: string) => {
  await expect(section(page, 'General').getByText(value, { exact: true })).toBeVisible();
});

Then('the row states that recompose never phones home', async ({ page }) => {
  await expect(section(page, 'General').getByText('recompose never phones home.')).toBeVisible();
});
