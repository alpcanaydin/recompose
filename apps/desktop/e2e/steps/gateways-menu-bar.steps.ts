import type { JSHandle, Page } from '@playwright/test';

import { expect } from '@playwright/test';

import type { TrayMenuEntry, TrayMenuProbe } from '../tray-menu';

import { Given, Then, When } from '../fixtures';
import { focusedGateway } from '../scenario-memory';
import { watchTrayMenu } from '../tray-menu';

const trayProbes = new WeakMap<Page, JSHandle<TrayMenuProbe>>();

function trayProbe(page: Page): JSHandle<TrayMenuProbe> {
  const probe = trayProbes.get(page);

  if (probe === undefined) {
    throw new Error('no step put recompose in the menu bar, so no tray menu exists to read');
  }

  return probe;
}

async function submenuOf(page: Page, name: string): Promise<TrayMenuEntry[]> {
  return trayProbe(page).evaluate((held, gateway) => held.submenuOf(gateway), name);
}

async function awaitSubmenu(page: Page, name: string): Promise<void> {
  await expect.poll(async () => (await submenuOf(page, name)).length).toBeGreaterThan(0);
}

function byLabel(one: TrayMenuEntry, other: TrayMenuEntry): number {
  return one.label.localeCompare(other.label);
}

/**
 * Waits for the submenu to read exactly this way.
 *
 * @summary The tray rebuilds from the ledger snapshot after reading the stored gateways, so the
 * menu catches up to a state change a moment after the screen does.
 */
async function expectEntries(
  page: Page,
  name: string,
  wanted: Record<string, boolean>,
): Promise<void> {
  const asked = Object.entries(wanted)
    .map(([label, enabled]) => ({ label, enabled }))
    .sort(byLabel);
  const labels = new Set(asked.map((entry) => entry.label));

  await expect
    .poll(async () =>
      (await submenuOf(page, name)).filter((entry) => labels.has(entry.label)).sort(byLabel),
    )
    .toEqual(asked);
}

Given('recompose stands in the menu bar', async ({ electronApp, page }) => {
  trayProbes.set(page, await watchTrayMenu(electronApp));

  await page.getByRole('link', { name: 'Settings' }).click();

  const control = page.getByRole('switch', { name: 'Show in menu bar' });

  await control.click();
  await expect(control).toBeChecked();
  await expect.poll(async () => trayProbe(page).evaluate((held) => held.stands())).toBe(true);
});

When('the maintainer opens the menu bar menu', async ({ page }) => {
  await awaitSubmenu(page, focusedGateway(page));
});

When('the maintainer chooses stop in the {string} submenu', async ({ page }, name: string) => {
  await expectEntries(page, name, { Stop: true });
  await trayProbe(page).evaluate((held, gateway) => {
    held.choose(gateway, 'Stop');
  }, name);
});

Then('the {string} submenu offers stop and restart', async ({ page }, name: string) => {
  await expectEntries(page, name, { Restart: true, Stop: true });
});

Then('the {string} submenu offers start', async ({ page }, name: string) => {
  await expectEntries(page, name, { Start: true });
});

Then('it shows start as unavailable', async ({ page }) => {
  await expectEntries(page, focusedGateway(page), { Start: false });
});

Then('it shows stop and restart as unavailable', async ({ page }) => {
  await expectEntries(page, focusedGateway(page), { Restart: false, Stop: false });
});
