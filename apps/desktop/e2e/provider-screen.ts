import type { ElectronApplication, Locator, Page } from '@playwright/test';

import { expect } from '@playwright/test';
import { subscriptionProviderIdSchema, subscriptionProviders } from '@recompose/contracts';
import { join } from 'node:path';

const CATALOG = 'Add provider';

const planTitles = { anthropic: 'Claude', openai: 'Codex' } as const;

const keyTitles = { anthropic: 'Anthropic API', openai: 'OpenAI API' } as const;

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

function keyCard(page: Page, provider: string): Locator {
  return catalog(page).getByRole('button', {
    name: new RegExp(`^${keyTitles[offeredId(provider)]}`, 'u'),
  });
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

/** Picks one plan, which is the only route to the sign-in the subscriptions screen offers. */
export async function openProviderWays(page: Page, provider: string): Promise<void> {
  await openCatalog(page);
  await planCard(page, provider).click();
  await expect(catalog(page).getByRole('button', { name: 'Back' })).toBeVisible();
}

/** Connects a key account from the keys screen, whose catalog holds the endpoint cards. */
export async function connectKeyAccount(page: Page, provider: string): Promise<void> {
  await page.getByRole('link', { name: 'API Keys' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'API Keys' })).toBeVisible();
  await openCatalog(page);
  await keyCard(page, provider).click();
  await catalog(page).getByLabel('Key', { exact: true }).fill('not-a-real-secret');
  await catalog(page).getByRole('button', { name: 'Connect' }).click();
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
