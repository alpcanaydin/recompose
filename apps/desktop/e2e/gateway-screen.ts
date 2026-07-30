import type { Locator, Page } from '@playwright/test';
import type { GatewayConfig } from '@recompose/contracts';

import { expect } from '@playwright/test';
import { GATEWAY_CONFIG_VERSION } from '@recompose/contracts';

import { addressOfPort } from './gateway-client';

const COPY_ADDRESS = 'Copy address';

const CREATE_GATEWAY = 'Create Gateway';

const CREATION_SHEET = 'Create a gateway';

/** Every gateway recompose holds on disk, read the way any surface reads it. */
export async function storedGateways(page: Page): Promise<GatewayConfig[]> {
  const answer = await page.evaluate(async () => window.recompose['gateways:list']());

  if (!answer.ok) {
    throw new Error(`the app could not list its gateways: ${answer.error.message}`);
  }

  return answer.value;
}

export async function storedGateway(page: Page, name: string): Promise<GatewayConfig> {
  const held = await storedGateways(page);
  const found = held.find((gateway) => gateway.displayName === name);

  if (found === undefined) {
    throw new Error(`recompose holds no gateway named "${name}"`);
  }

  return found;
}

export function gatewayRow(page: Page, name: string): Locator {
  return page.getByRole('link', { name: new RegExp(`^${name} (Running|Stopped)$`, 'u') });
}

export function gatewayRowReading(page: Page, name: string, state: string): Locator {
  return page.getByRole('link', { exact: true, name: `${name} ${state}` });
}

/** Where a gateway serves, taken from what it stores rather than from what a screen shows. */
export async function gatewayAddress(page: Page, name: string): Promise<string> {
  return addressOfPort((await storedGateway(page, name)).port);
}

/** Selects a gateway, which is the only way to reach the toolbar that acts on it. */
export async function openGateway(page: Page, name: string): Promise<void> {
  await gatewayRow(page, name).click();
  await expect(page.getByRole('button', { name: COPY_ADDRESS })).toBeVisible();
}

export async function pressToolbarControl(page: Page, name: string, action: string): Promise<void> {
  await openGateway(page, name);
  await page.getByRole('button', { name: action }).click();
}

/** The address a person copies out of the toolbar, read off the pill rather than computed. */
export async function shownAddress(page: Page): Promise<string> {
  const pill = page.getByRole('button', { name: COPY_ADDRESS }).locator('xpath=..');
  const shown = await pill.innerText();
  const [address] = /http:\/\/\S+/u.exec(shown) ?? [];

  if (address === undefined) {
    throw new Error(`the toolbar shows no address, only "${shown}"`);
  }

  return address;
}

/** Stops a gateway without walking the toolbar, for a scenario that starts from a stopped one. */
export async function haltGateway(page: Page, name: string): Promise<void> {
  const { slug } = await storedGateway(page, name);
  const answer = await page.evaluate(
    async (stopping) => window.recompose['engine:stop']({ slug: stopping }),
    slug,
  );

  if (!answer.ok) {
    throw new Error(`the app could not stop "${name}": ${answer.error.message}`);
  }

  await expect(gatewayRowReading(page, name, 'Stopped')).toBeVisible();
}

export function creationSheet(page: Page): Locator {
  return page.getByRole('dialog', { name: CREATION_SHEET });
}

export function sheetField(page: Page, label: string): Locator {
  return creationSheet(page).getByRole('textbox', { name: label });
}

/** The sentence standing under a field, which the sheet writes there when a save refuses. */
export function fieldRefusal(page: Page, label: string): Locator {
  return sheetField(page, label).locator('xpath=../..').getByRole('alert');
}

/**
 * Puts a gateway on disk without walking the sheet, and shows the screen what landed.
 *
 * @summary A scenario that starts from an existing gateway is describing where it starts rather
 * than what it proves, so the arrangement takes the shortest honest route and reloads the screen.
 */
export async function seedGateway(page: Page, name: string): Promise<GatewayConfig> {
  const offered = await page.evaluate(async () => window.recompose['gateways:offer-port']());

  if (!offered.ok) {
    throw new Error(`the app offered no free port: ${offered.error.message}`);
  }

  const config: GatewayConfig = {
    schemaVersion: GATEWAY_CONFIG_VERSION,
    slug: name,
    displayName: name,
    port: offered.value,
    virtualModels: [],
    layout: { nodes: {} },
  };
  const saved = await page.evaluate(
    async (gateway) => window.recompose['gateways:save'](gateway),
    config,
  );

  if (!saved.ok) {
    throw new Error(`the app stored no gateway named "${name}": ${saved.error.message}`);
  }

  await page.reload();
  await expect(gatewayRow(page, name)).toBeVisible();

  return config;
}

/** Opens the sheet the way the screen offers it, which differs before and after the first gateway. */
export async function openCreationSheet(page: Page): Promise<void> {
  if (await creationSheet(page).isVisible()) {
    return;
  }

  const invitation = page.getByRole('button', { name: CREATE_GATEWAY });

  await ((await invitation.count()) > 0
    ? invitation.click()
    : page.getByRole('button', { name: 'New Gateway…' }).click());

  await expect(creationSheet(page)).toBeVisible();
}

/** Whatever the port field holds right now, waiting out the offer the sheet arrives fetching. */
export async function portFieldValue(page: Page): Promise<string> {
  const field = sheetField(page, 'Port');

  await expect(field).not.toHaveValue('');

  return field.inputValue();
}

export type GatewayDraft = {
  name: string;
  slug: string;
  port?: string;
};

export async function fillSheet(page: Page, draft: GatewayDraft): Promise<void> {
  await sheetField(page, 'Name').fill(draft.name);
  await sheetField(page, 'Slug').fill(draft.slug);

  if (draft.port !== undefined) {
    await sheetField(page, 'Port').fill(draft.port);
  }
}

export async function pressCreate(page: Page): Promise<void> {
  await creationSheet(page).getByRole('button', { name: CREATE_GATEWAY }).click();
}

/** The whole creation walk, from the offer on screen to a sheet that has closed behind it. */
export async function createThroughSheet(page: Page, draft: GatewayDraft): Promise<string> {
  await openCreationSheet(page);
  await fillSheet(page, draft);

  const carried = await portFieldValue(page);

  await pressCreate(page);
  await expect(creationSheet(page)).toBeHidden();

  return carried;
}
