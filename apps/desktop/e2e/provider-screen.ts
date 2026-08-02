import type { ElectronApplication, Locator, Page } from '@playwright/test';

import { expect } from '@playwright/test';
import { subscriptionProviderIdSchema, subscriptionProviders } from '@recompose/contracts';
import { join } from 'node:path';

const CATALOG = 'Add provider';

const PROVIDER_ROW = /^(Anthropic|OpenAI|OpenRouter)$/u;

export function catalog(page: Page): Locator {
  return page.getByRole('dialog', { name: CATALOG });
}

/** Every provider the catalog offers right now, whatever heading each one stands under. */
export function offeredProviders(page: Page): Locator {
  return catalog(page).getByRole('button', { name: PROVIDER_ROW });
}

export function catalogGroupTitles(page: Page): Locator {
  return catalog(page).getByRole('heading', { level: 3 });
}

/**
 * What each named row reads as, once its own decoration is allowed for.
 *
 * @summary A decorative monogram leads every provider row and lands in the row's words without
 * touching its accessible name, so a name is what a row's words end with rather than all of them.
 */
export function readingAs(...names: readonly string[]): RegExp[] {
  return names.map((name) => new RegExp(`${name}$`, 'u'));
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

export async function openSubscriptionsScreen(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Subscriptions' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Subscriptions' })).toBeVisible();
}

/** Opens the catalog, or leaves it standing when an earlier step already opened it. */
export async function openCatalog(page: Page): Promise<void> {
  if (await catalog(page).isVisible()) {
    return;
  }

  await page.getByRole('main').getByRole('button', { name: CATALOG }).click();
  await expect(catalog(page)).toBeVisible();
}

/** Picks one provider, which is the only route to either of the ways it connects. */
export async function openProviderWays(page: Page, provider: string): Promise<void> {
  await openCatalog(page);
  await catalog(page).getByRole('button', { name: provider }).click();
  await expect(catalog(page).getByRole('button', { name: 'All providers' })).toBeVisible();
}

/** Connects an account from a key, which the catalog's gateway-target way is the only route to. */
export async function connectKeyAccount(
  page: Page,
  provider: string,
  label: string,
): Promise<void> {
  const keyWay = catalog(page).getByRole('region', { name: 'A target a gateway can reach' });

  await openProviderWays(page, provider);
  await keyWay.getByLabel('Label', { exact: true }).fill(label);
  await keyWay.getByLabel('Key', { exact: true }).fill('not-a-real-secret');
  await keyWay.getByRole('button', { name: 'Connect' }).click();
  await expect(catalog(page)).toBeHidden();
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
