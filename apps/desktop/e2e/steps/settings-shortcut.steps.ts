import type { ElectronApplication, Page } from '@playwright/test';

import { expect } from '@playwright/test';

import { chooseMenuItem } from '../app-menu';
import { Given, Then, When } from '../fixtures';

const settingsMenuLabel = 'Settings…';

const menuBarSwitchLabel = 'Show in menu bar';

const firstControlWhenUnpackaged = 'Show in menu bar';

async function openWindowCount(electronApp: ElectronApplication): Promise<number> {
  return electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
}

function liveWindows(electronApp: ElectronApplication): Page[] {
  return electronApp.windows().filter((window) => !window.isClosed());
}

async function openedWindow(electronApp: ElectronApplication): Promise<Page> {
  await expect.poll(() => liveWindows(electronApp).length).toBeGreaterThan(0);

  const [window] = liveWindows(electronApp);

  if (window === undefined) {
    throw new Error('the window the app opened closed before the scenario could read it');
  }

  await window.waitForLoadState('domcontentloaded');

  return window;
}

Given('the menu bar switch is on and the last window is closed', async ({ electronApp, page }) => {
  await page.getByRole('link', { name: 'Settings' }).click();

  const menuBar = page.getByRole('switch', { name: menuBarSwitchLabel });

  await menuBar.click();
  await expect(menuBar).toBeChecked();

  await electronApp.evaluate(({ BrowserWindow }) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.close();
    }
  });

  await expect.poll(async () => openWindowCount(electronApp)).toBe(0);
});

When('the maintainer presses the settings shortcut', async ({ electronApp }) => {
  await chooseMenuItem(electronApp, settingsMenuLabel);
});

Then('the main window shows the settings screen', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
});

Then('the sidebar selection moves to Settings', async ({ page }) => {
  await expect(page.getByRole('link', { name: 'Settings' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

Then('focus lands on the first control', async ({ page }) => {
  await expect(page.getByRole('switch', { name: firstControlWhenUnpackaged })).toBeFocused();
});

Then('a window opens on the settings screen', async ({ electronApp }) => {
  const window = await openedWindow(electronApp);

  await expect(window.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
});

Then('one window stands open', async ({ electronApp }) => {
  await expect.poll(async () => openWindowCount(electronApp)).toBe(1);
});
