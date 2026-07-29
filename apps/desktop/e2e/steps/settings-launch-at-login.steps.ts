import type { ElectronApplication, Locator, Page } from '@playwright/test';
import type { SystemState } from '@recompose/contracts';

import { expect } from '@playwright/test';

import { Given, test, Then, When } from '../fixtures';

const switchLabel = 'Launch at login';

const developmentBuildReason = 'A development build cannot register itself as a login item.';

const platformsCarryingLoginItems: readonly NodeJS.Platform[] = ['darwin', 'win32'];

function operatingSystemCarriesLoginItems(): boolean {
  return platformsCarryingLoginItems.includes(process.platform);
}

function containing(sentence: string): RegExp {
  return new RegExp(sentence.replaceAll(/[$()*+.?[\\\]^{|}]/gu, '\\$&'), 'u');
}

function launchAtLoginSwitch(page: Page): Locator {
  return page.getByRole('switch', { name: switchLabel });
}

async function reportedAvailability(page: Page): Promise<SystemState['loginItem']> {
  const system = await page.evaluate(async () => window.recompose['system:get']());

  if (!system.ok) {
    throw new Error('the app could not report whether it carries a login item');
  }

  return system.value.loginItem;
}

async function storedLaunchAtLogin(page: Page): Promise<boolean> {
  const stored = await page.evaluate(async () => window.recompose['settings:get']());

  if (!stored.ok) {
    throw new Error('the app could not read the stored settings document');
  }

  return stored.value.launchAtLogin;
}

async function operatingSystemListsRecompose(app: ElectronApplication): Promise<boolean> {
  return app.evaluate(
    ({ app: running }) =>
      running.getLoginItemSettings({ path: process.execPath, args: [] }).openAtLogin,
  );
}

Given('the app runs on Linux', () => {
  test.skip(process.platform !== 'linux', 'the absent row is a state only Linux reaches');
});

Given('the app runs unpackaged from a development build', async ({ page }) => {
  test.skip(!operatingSystemCarriesLoginItems(), 'Linux carries no launch-at-login row to render');

  expect(await reportedAvailability(page)).toBe('unpackaged');
});

Given('the operating system reports recompose as a login item', () => {
  test.fixme(
    true,
    'listing recompose at login is machine-global state that every acceptance fixture reads on launch and writes back on teardown, so a parallel worker restores the listing this scenario created',
  );
});

Given('the stored launch-at-login flag reads off', async ({ page }) => {
  expect(await storedLaunchAtLogin(page)).toBe(false);
});

When('the app opens the settings screen', async ({ page }) => {
  await page.getByRole('link', { name: 'Settings' }).click();

  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
});

Then('the screen carries no launch-at-login row', async ({ page }) => {
  await expect(launchAtLoginSwitch(page)).toHaveCount(0);
});

Then('the launch-at-login switch cannot be moved', async ({ electronApp, page }) => {
  const control = launchAtLoginSwitch(page);

  await expect(control).toHaveAttribute('aria-disabled', 'true');

  await control.focus();
  await page.keyboard.press('Space');
  await control.click({ force: true });

  await expect(control).not.toBeChecked();

  expect(await storedLaunchAtLogin(page)).toBe(false);
  expect(await operatingSystemListsRecompose(electronApp)).toBe(false);
});

Then('the row names the development build as the reason', async ({ page }) => {
  await expect(launchAtLoginSwitch(page)).toHaveAccessibleDescription(
    containing(developmentBuildReason),
  );
});

Then('the switch reads on', async ({ page }) => {
  await expect(launchAtLoginSwitch(page)).toBeChecked();
});
