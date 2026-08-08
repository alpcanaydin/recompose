import type { Locator, Page } from '@playwright/test';

import { expect } from '@playwright/test';

import { gatewayRow } from './gateway-screen';

const ADD_MODEL = 'Add virtual model';

function asideHeaded(page: Page, heading: string): Locator {
  return page
    .locator('aside')
    .filter({ has: page.getByRole('heading', { exact: true, level: 2, name: heading }) });
}

/** The inspector for one gateway, which stands beside the stage the moment a gateway is picked. */
function gatewayDrawer(page: Page, name: string): Locator {
  return asideHeaded(page, name);
}

/** The drawer while the define flow holds it, which is where the three fields stand. */
export function defineFlow(page: Page): Locator {
  return asideHeaded(page, ADD_MODEL);
}

/** Picks a gateway out of the sidebar and waits for its inspector to stand. */
export async function openGatewayDrawer(page: Page, name: string): Promise<void> {
  await gatewayRow(page, name).click();
  await expect(gatewayDrawer(page, name)).toBeVisible();
}

/** Every virtual model the drawer shows the gateway serving. */
export function servedRows(page: Page, name: string): Locator {
  return gatewayDrawer(page, name).getByRole('listitem');
}

export function servedRow(page: Page, name: string, carrying: string): Locator {
  return servedRows(page, name).filter({ hasText: carrying });
}

/**
 * The lines one row prints, in the order a person reads down them.
 *
 * @summary A row is read whole rather than matched line by line, because two lines of a stacked
 * row can carry the same words and a locator that finds both proves nothing about their order.
 */
export async function rowLines(row: Locator): Promise<string[]> {
  const printed = await row.innerText();

  return printed
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

function nameField(page: Page): Locator {
  return defineFlow(page).getByRole('textbox', { name: 'Name' });
}

/** The refusal the flow prints, which the failed look and the refused save both stand as. */
export function flowRefusal(page: Page): Locator {
  return defineFlow(page).getByRole('alert');
}

/** One kind the picker gathers accounts under, named the way the picker names it. */
export function offeredKind(page: Page, kind: string): Locator {
  return defineFlow(page).getByText(kind, { exact: true });
}

/** One account on offer as a target, which reads as its name beside whatever marks it. */
export function targetOption(page: Page, account: string): Locator {
  return defineFlow(page).getByRole('button', { name: account });
}

/** One model on offer, which reads as the id a provider serves it under and nothing else. */
export function modelOption(page: Page, providerModel: string): Locator {
  return defineFlow(page).getByRole('button', { exact: true, name: providerModel });
}

/** Opens the define flow from the drawer, and waits for the field a person types first. */
export async function openDefineFlow(page: Page, name: string): Promise<void> {
  await openGatewayDrawer(page, name);
  await gatewayDrawer(page, name).getByRole('button', { name: ADD_MODEL }).click();
  await expect(nameField(page)).toBeVisible();
}

/** Picks a target and waits for the flow to stop offering the field that waits on one. */
export async function pickTarget(page: Page, account: string): Promise<void> {
  await targetOption(page, account).click();
  await expect(defineFlow(page).getByText('Pick a target first.')).toBeHidden();
}

export type VirtualModelDraft = {
  name: string;
  target: string;
  providerModel: string;
};

/** The whole define walk, from the drawer's invitation to a flow that has closed behind it. */
export async function defineThroughDrawer(
  page: Page,
  gateway: string,
  draft: VirtualModelDraft,
): Promise<void> {
  await openDefineFlow(page, gateway);
  await nameField(page).fill(draft.name);
  await pickTarget(page, draft.target);
  await modelOption(page, draft.providerModel).click();
  await defineFlow(page).getByRole('button', { name: ADD_MODEL }).click();
  await expect(defineFlow(page)).toBeHidden();
}
