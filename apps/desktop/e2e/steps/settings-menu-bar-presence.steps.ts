import type { ElectronApplication, Locator, Page } from '@playwright/test';

import { expect } from '@playwright/test';

import { Given, Then, When } from '../fixtures';

const menuBarSwitchLabel = 'Show in menu bar';

function menuBarSwitch(page: Page): Locator {
  return page.getByRole('switch', { name: menuBarSwitchLabel });
}

async function trayStandsInMenuBar(page: Page): Promise<boolean> {
  const system = await page.evaluate(async () => window.recompose['system:get']());

  if (!system.ok) {
    throw new Error('the app could not report whether a tray stands in the menu bar');
  }

  return system.value.menuBarVisible;
}

function liveWindows(electronApp: ElectronApplication): Page[] {
  return electronApp.windows().filter((candidate) => !candidate.isClosed());
}

async function windowReopenedAfterActivation(electronApp: ElectronApplication): Promise<Page> {
  await electronApp.evaluate(({ app }) => {
    app.emit('activate');
  });

  await expect.poll(() => liveWindows(electronApp).length).toBeGreaterThan(0);

  const [window] = liveWindows(electronApp);

  if (window === undefined) {
    throw new Error('the app opened no window to report the tray through');
  }

  await window.waitForLoadState('domcontentloaded');

  return window;
}

Given('the menu bar switch is on', async ({ page }) => {
  const control = menuBarSwitch(page);

  await control.click();

  await expect(control).toBeChecked();
  await expect.poll(async () => trayStandsInMenuBar(page)).toBe(true);
});

When('the maintainer turns the menu bar switch on', async ({ page }) => {
  await menuBarSwitch(page).click();
});

When('the maintainer turns the switch off', async ({ page }) => {
  await menuBarSwitch(page).click();
});

Then('a tray icon stands in the menu bar', async ({ page }) => {
  await expect.poll(async () => trayStandsInMenuBar(page)).toBe(true);
  await expect(menuBarSwitch(page)).toBeChecked();
});

Then('no tray icon stands in the menu bar', async ({ page }) => {
  await expect.poll(async () => trayStandsInMenuBar(page)).toBe(false);
  await expect(menuBarSwitch(page)).not.toBeChecked();
});

When('the maintainer closes the last window', async ({ electronApp }) => {
  await electronApp.evaluate(({ BrowserWindow }) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.close();
    }
  });

  await expect.poll(() => liveWindows(electronApp).length).toBe(0);
});

Then('the app keeps running', async ({ electronApp }) => {
  await expect(electronApp.evaluate(({ app }) => app.isReady())).resolves.toBe(true);
});

Then('the tray stays', async ({ electronApp }) => {
  const window = await windowReopenedAfterActivation(electronApp);

  await expect.poll(async () => trayStandsInMenuBar(window)).toBe(true);
});
