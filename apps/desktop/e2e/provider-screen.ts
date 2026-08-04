import type { ElectronApplication, Locator, Page } from '@playwright/test';

import { expect } from '@playwright/test';
import { subscriptionProviderIdSchema, subscriptionProviders } from '@recompose/contracts';
import { join } from 'node:path';

const CATALOG = 'Add provider';

const planTitles = { anthropic: 'Claude', openai: 'Codex' } as const;

/** Every entry the key catalog offers, in the order a person reads them. */
export const keyCatalogEntries = [
  'Anthropic API',
  'OpenAI API',
  'Gemini API',
  'Mistral',
  'xAI Grok',
  'DeepSeek',
  'Moonshot AI',
  'Qwen',
  'Custom endpoint',
] as const;

/** The middle of every key a scenario pastes, which no part of the screen may ever print. */
export const keyBody = 'not-a-real-key-';

/** What a person typed into the two fields a picked entry asks for. */
export type PastedKey = {
  /** The catalog entry the key was picked under, which settles its provider. */
  entry: string;
  name: string;
  pasted: string;
};

/** Where something stands, so a step can prove an order the roles alone cannot carry. */
export type Placement = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerY: number;
};

export function catalog(page: Page): Locator {
  return page.getByRole('dialog', { name: CATALOG });
}

function offeredId(provider: string): keyof typeof planTitles {
  if (provider !== 'anthropic' && provider !== 'openai') {
    throw new Error(`the catalog offers no ${provider}`);
  }

  return provider;
}

/** The card one provider's plan stands as on the subscriptions catalog. */
export function planCard(page: Page, provider: string): Locator {
  return catalog(page).getByRole('button', {
    name: new RegExp(`^${planTitles[offeredId(provider)]}`, 'u'),
  });
}

/** The card one catalog entry stands as, named the way the catalog names it. */
export function catalogEntry(page: Page, entry: string): Locator {
  return catalog(page).getByRole('button', { name: new RegExp(`^${entry}`, 'u') });
}

/** Read from the document, because an open drawer hides the screen behind it from the roles. */
export function screenTitle(page: Page): Locator {
  return page.locator('main h1');
}

export function accountRows(page: Page): Locator {
  return page.getByRole('main').getByRole('listitem');
}

export function accountRow(page: Page, carrying: string): Locator {
  return accountRows(page).filter({ hasText: carrying });
}

/**
 * The line of a row whose whole text is the given words.
 *
 * @summary A vendor's mark names itself in a title inside its own drawing, so a row that leads
 * with a mark carries the provider's name twice. A row's words are read from the lines that print
 * them, which leaves the drawing out of every reading.
 */
export function rowLine(row: Locator, words: string): Locator {
  return row.getByText(words, { exact: true }).and(row.locator('span'));
}

export function nameField(page: Page): Locator {
  return catalog(page).getByLabel('Name', { exact: true });
}

export function keyField(page: Page): Locator {
  return catalog(page).getByLabel('Key', { exact: true });
}

/** The one knob the detect step offers, which points the look at another loopback port. */
export function portField(page: Page): Locator {
  return catalog(page).getByLabel('Port', { exact: true });
}

/** The answer one row carries about its key, which stands only while the screen shows it. */
export function keyVerdict(page: Page): Locator {
  return accountRows(page).first().getByRole('status');
}

/**
 * Walks the sidebar to one provider destination and waits for its screen to stand.
 *
 * @summary Every destination reads the same way, so the name a person clicks is also the name the
 * screen answers to, and a scenario names its destination once.
 */
export async function openProviderScreen(page: Page, destination: string): Promise<void> {
  await page.getByRole('link', { name: destination }).click();
  await expect(page.getByRole('heading', { level: 1, name: destination })).toBeVisible();
}

/** Opens the catalog, or leaves it standing when an earlier step already opened it. */
export async function openCatalog(page: Page): Promise<void> {
  if (await catalog(page).isVisible()) {
    return;
  }

  await page.getByRole('main').getByRole('button', { name: CATALOG }).click();
  await expect(catalog(page)).toBeVisible();
}

/** Picks one plan, which is the only route to the sign-in the subscriptions screen offers. */
export async function openProviderWays(page: Page, provider: string): Promise<void> {
  await openCatalog(page);
  await planCard(page, provider).click();
  await expect(catalog(page).getByRole('button', { name: 'Back' })).toBeVisible();
}

/**
 * Picks one entry, which is the only route to the way that entry connects under.
 *
 * @summary Which way opens is the entry's own business, so the pick waits only for the step to
 * arrive and leaves what it asks for to the scenario reading it.
 */
export async function pickEntry(page: Page, entry: string): Promise<void> {
  await openCatalog(page);
  await catalogEntry(page, entry).click();
  await expect(catalog(page).getByRole('button', { name: 'Back' })).toBeVisible();
}

/** Picks one key entry, which is the only route to the form that asks for a name and a key. */
async function pickKeyEntry(page: Page, entry: string): Promise<void> {
  await pickEntry(page, entry);
  await expect(keyField(page)).toBeVisible();
}

/** What the local connect step reports about its look, filling a slot that reserved its height. */
export function detectReading(page: Page): Locator {
  return catalog(page).getByRole('status');
}

/** A key plainly nobody's, ending in the four characters a scenario expects the mask to read. */
export function keyEndingIn(entry: string, tail: string): string {
  const opening = entry === 'Anthropic API' ? 'sk-ant-api03-' : 'sk-';

  return `${opening}${keyBody}${tail}`;
}

/** The key a step pastes where the scenario says only that a key stands connected. */
export function keyAScenarioPastes(entry: string): string {
  return keyEndingIn(entry, '7f2c');
}

export async function fillKeyForm(page: Page, key: PastedKey): Promise<void> {
  await pickKeyEntry(page, key.entry);
  await nameField(page).fill(key.name);
  await keyField(page).fill(key.pasted);
}

export async function submitConnect(page: Page): Promise<void> {
  await catalog(page).getByRole('button', { name: 'Connect' }).click();
}

/** Hands over both fields and asks to connect, leaving the outcome for the scenario to read. */
export async function connectKey(page: Page, key: PastedKey): Promise<void> {
  await fillKeyForm(page, key);
  await submitConnect(page);
}

/** Connects one key and waits for the catalog to hand the screen back. */
export async function keyStandsConnected(page: Page, key: PastedKey): Promise<void> {
  await connectKey(page, key);
  await expect(catalog(page)).toBeHidden();
  await expect(accountRow(page, key.entry).filter({ hasText: key.name })).toBeVisible();
}

async function runtimeSettlesTheLook(page: Page, runtime: string, act: string): Promise<void> {
  await pickEntry(page, runtime);
  await catalog(page).getByRole('button', { name: act }).click();
  await expect(catalog(page)).toBeHidden();
}

/** Adds a runtime the look found, through the act an answering reading offers. */
export async function runtimeStandsAdded(page: Page, runtime: string): Promise<void> {
  await runtimeSettlesTheLook(page, runtime, `Add ${runtime}`);
}

/** Adds a runtime the look never found, through the plain act a silent reading offers. */
export async function runtimeStandsAddedAnyway(page: Page, runtime: string): Promise<void> {
  await runtimeSettlesTheLook(page, runtime, 'Add anyway');
}

export async function placementOf(locator: Locator): Promise<Placement> {
  const box = await locator.boundingBox();

  if (box === null) {
    throw new Error('the step asked where something stands that never reached the screen');
  }

  return {
    left: box.x,
    right: box.x + box.width,
    top: box.y,
    bottom: box.y + box.height,
    centerY: box.y + box.height / 2,
  };
}

export function toolBinaryFor(provider: string): string {
  return subscriptionProviders[subscriptionProviderIdSchema.parse(provider)].toolBinary;
}

export function toolNameFor(provider: string): string {
  return subscriptionProviders[subscriptionProviderIdSchema.parse(provider)].toolName;
}

export async function userDataFolder(app: ElectronApplication): Promise<string> {
  return app.evaluate(({ app: running }) => running.getPath('userData'));
}

/** Where every config home for one provider is kept, which exists only once a sign-in begins. */
export async function toolHomesFolder(app: ElectronApplication, provider: string): Promise<string> {
  const userData = await userDataFolder(app);

  return join(userData, 'subscriptions', subscriptionProviderIdSchema.parse(provider));
}

/** The config home the provider's tool currently runs against, reached through the active pointer. */
export async function activeToolHome(app: ElectronApplication, provider: string): Promise<string> {
  return join(await toolHomesFolder(app, provider), 'active');
}
