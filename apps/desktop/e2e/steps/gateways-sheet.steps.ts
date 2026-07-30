import type { Page } from '@playwright/test';

import { expect } from '@playwright/test';
import { GATEWAY_PORT_RANGE } from '@recompose/contracts';

import { Then, When } from '../fixtures';
import {
  creationSheet,
  fieldRefusal,
  fillSheet,
  openCreationSheet,
  portFieldValue,
  pressCreate,
  sheetField,
  storedGateway,
} from '../gateway-screen';
import { portIsFree } from '../loopback-ports';

/** The gateway a slug or port scenario is drafting, which is never the one already stored. */
const DRAFT = { name: 'Gemini', slug: 'gemini' };

/** The port a gateway held before the sheet tried to take it, so the refusal can be proved idle. */
const portsBeforeTheAttempt = new WeakMap<Page, number>();

function addressOf(port: string): string {
  return `http://localhost:${port}`;
}

async function previewShows(page: Page, address: string): Promise<void> {
  await expect(creationSheet(page).getByText('Serves at')).toBeVisible();
  await expect(creationSheet(page).getByText(address, { exact: true })).toBeVisible();
}

When('the maintainer opens the creation sheet', async ({ page }) => {
  await openCreationSheet(page);
});

Then('the port field already holds a free port', async ({ page }) => {
  const offered = Number(await portFieldValue(page));

  expect(offered).toBeGreaterThanOrEqual(GATEWAY_PORT_RANGE.min);
  expect(offered).toBeLessThanOrEqual(GATEWAY_PORT_RANGE.max);
  await expect.poll(async () => portIsFree(offered)).toBe(true);
});

Then('the preview carries that port', async ({ page }) => {
  await previewShows(page, addressOf(await portFieldValue(page)));
});

When('the maintainer replaces the port with {int}', async ({ page }, port: number) => {
  await sheetField(page, 'Port').fill(String(port));
});

Then('the sheet previews serving at {string}', async ({ page }, address: string) => {
  await previewShows(page, address);
});

When('the maintainer tries the slug {string}', async ({ page }, slug: string) => {
  await fillSheet(page, { name: slug, slug });
  await pressCreate(page);
});

When('the maintainer tries the port {int}', async ({ page }, port: number) => {
  await fillSheet(page, { ...DRAFT, port: String(port) });
  await pressCreate(page);
});

When('the maintainer tries the port that {string} holds', async ({ page }, name: string) => {
  const { port } = await storedGateway(page, name);

  portsBeforeTheAttempt.set(page, port);
  await fillSheet(page, { ...DRAFT, port: String(port) });
  await pressCreate(page);
});

Then('the sheet stays open', async ({ page }) => {
  await expect(creationSheet(page)).toBeVisible();
});

Then('the slug field reads {string}', async ({ page }, refusal: string) => {
  await expect(fieldRefusal(page, 'Slug')).toHaveText(refusal);
});

Then('the port field reads {string}', async ({ page }, refusal: string) => {
  await expect(fieldRefusal(page, 'Port')).toHaveText(refusal);
});

Then('{string} keeps its port', async ({ page }, name: string) => {
  expect((await storedGateway(page, name)).port).toBe(portsBeforeTheAttempt.get(page));
});
