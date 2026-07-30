import type { Page } from '@playwright/test';

import { expect } from '@playwright/test';

import { chooseMenuItem } from '../app-menu';
import { Then, When } from '../fixtures';
import {
  createThroughSheet,
  gatewayRow,
  sheetField,
  storedGateway,
  storedGateways,
} from '../gateway-screen';
import { freePort } from '../loopback-ports';
import { restartedAppFor } from './app.steps';

const NEW_GATEWAY_MENU_ITEM = 'New Gateway…';

/** The port the sheet arrived holding, kept so the assertion can tell an offer from a guess. */
const portsTheSheetOffered = new WeakMap<Page, string>();

/** The port the maintainer wrote over the offer, kept for the same reason. */
const portsTheMaintainerTyped = new WeakMap<Page, string>();

function rememberedPort(held: WeakMap<Page, string>, page: Page): number {
  const port = held.get(page);

  if (port === undefined) {
    throw new Error('the scenario read a port back before any step recorded one');
  }

  return Number(port);
}

Then('the screen invites {string}', async ({ page }, invitation: string) => {
  await expect(page.getByRole('heading', { level: 1, name: invitation })).toBeVisible();
});

Then('the sidebar lists no gateway', async ({ page }) => {
  await expect(page.getByRole('group', { name: 'Local Gateways' })).toHaveCount(0);
});

When('the maintainer chooses {string}', async ({ page }, label: string) => {
  await page.getByRole('button', { name: label }).click();
});

When('the maintainer asks for a new gateway from the sidebar', async ({ page }) => {
  await page.getByRole('button', { name: NEW_GATEWAY_MENU_ITEM }).click();
});

When('the maintainer presses the shortcut for a new gateway', async ({ electronApp }) => {
  await chooseMenuItem(electronApp, NEW_GATEWAY_MENU_ITEM);
});

Then('the {string} sheet opens', async ({ page }, title: string) => {
  await expect(page.getByRole('dialog', { name: title })).toBeVisible();
});

Then('the name field holds focus', async ({ page }) => {
  await expect(sheetField(page, 'Name')).toBeFocused();
});

When(
  'the maintainer creates the gateway {string} with the slug {string}, leaving the port alone',
  async ({ page }, name: string, slug: string) => {
    portsTheSheetOffered.set(page, await createThroughSheet(page, { name, slug }));
  },
);

Then(
  'the stored gateway carries the name {string}, the slug {string}, and the offered port',
  async ({ page }, name: string, slug: string) => {
    const [stored] = await storedGateways(page);

    expect(stored?.displayName).toBe(name);
    expect(stored?.slug).toBe(slug);
    expect(stored?.port).toBe(rememberedPort(portsTheSheetOffered, page));
  },
);

When(
  'the maintainer creates the gateway {string} on a free port they typed themselves',
  async ({ page }, name: string) => {
    const port = String(await freePort());

    portsTheMaintainerTyped.set(page, port);
    await createThroughSheet(page, { name, port, slug: name });
  },
);

Then('the stored gateway {string} carries the typed port', async ({ page }, name: string) => {
  expect((await storedGateway(page, name)).port).toBe(
    rememberedPort(portsTheMaintainerTyped, page),
  );
});

Then('the sidebar lists {string}', async ({ page }, name: string) => {
  await expect(gatewayRow(restartedAppFor(page).page, name)).toBeVisible();
});
