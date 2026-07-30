import type { Locator, Page } from '@playwright/test';
import type { GatewayConfig } from '@recompose/contracts';

import { expect } from '@playwright/test';
import { GATEWAY_CONFIG_VERSION } from '@recompose/contracts';

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

function creationSheet(page: Page): Locator {
  return page.getByRole('dialog', { name: CREATION_SHEET });
}

export function sheetField(page: Page, label: string): Locator {
  return creationSheet(page).getByRole('textbox', { name: label });
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
async function openCreationSheet(page: Page): Promise<void> {
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
async function portFieldValue(page: Page): Promise<string> {
  const field = sheetField(page, 'Port');

  await expect(field).not.toHaveValue('');

  return field.inputValue();
}

export type GatewayDraft = {
  name: string;
  slug: string;
  port?: string;
};

/** The whole creation walk, from the offer on screen to a sheet that has closed behind it. */
export async function createThroughSheet(page: Page, draft: GatewayDraft): Promise<string> {
  await openCreationSheet(page);
  await sheetField(page, 'Name').fill(draft.name);
  await sheetField(page, 'Slug').fill(draft.slug);

  if (draft.port !== undefined) {
    await sheetField(page, 'Port').fill(draft.port);
  }

  const carried = await portFieldValue(page);

  await creationSheet(page).getByRole('button', { name: CREATE_GATEWAY }).click();
  await expect(creationSheet(page)).toBeHidden();

  return carried;
}
