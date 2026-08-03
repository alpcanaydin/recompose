import type { Page } from '@playwright/test';

const gatewaysInFocus = new WeakMap<Page, string>();

const providersInFocus = new WeakMap<Page, string>();

const portsAnotherProcessTook = new WeakMap<Page, number>();

export function focusGateway(page: Page, name: string): void {
  gatewaysInFocus.set(page, name);
}

/** The gateway the scenario last acted on, which is the one its later steps talk about. */
export function focusedGateway(page: Page): string {
  const name = gatewaysInFocus.get(page);

  if (name === undefined) {
    throw new Error('no step named the gateway this scenario is about');
  }

  return name;
}

export function focusProvider(page: Page, provider: string): void {
  providersInFocus.set(page, provider);
}

/** The provider the scenario last picked out of the catalog, which its later steps talk about. */
export function focusedProvider(page: Page): string {
  const provider = providersInFocus.get(page);

  if (provider === undefined) {
    throw new Error('no step named the provider this scenario is about');
  }

  return provider;
}

const entriesInFocus = new WeakMap<Page, string>();

const vaultsBeforeARefusal = new WeakMap<Page, string>();

const warningsTheSurfaceShowed = new WeakMap<Page, string>();

export function rememberKeyEntry(page: Page, entry: string): void {
  entriesInFocus.set(page, entry);
}

/** The catalog entry the scenario last picked, which is the product its later steps read. */
export function keyEntryInFocus(page: Page): string {
  const entry = entriesInFocus.get(page);

  if (entry === undefined) {
    throw new Error('no step named the catalog entry this scenario is about');
  }

  return entry;
}

export function rememberVault(page: Page, kept: string): void {
  vaultsBeforeARefusal.set(page, kept);
}

/** What the vault held before the scenario asked for a connect it expected to be refused. */
export function vaultBeforeTheRefusal(page: Page): string {
  const kept = vaultsBeforeARefusal.get(page);

  if (kept === undefined) {
    throw new Error('no step read the vault before the refusal this scenario is about');
  }

  return kept;
}

export function rememberWarning(page: Page, sentence: string): void {
  warningsTheSurfaceShowed.set(page, sentence);
}

/** What the surface warned while the key stood in the field, before the connect carried it off. */
export function warningTheSurfaceShowed(page: Page): string {
  const sentence = warningsTheSurfaceShowed.get(page);

  if (sentence === undefined) {
    throw new Error('no step read a warning off the surface in this scenario');
  }

  return sentence;
}

export function rememberTakenPort(page: Page, port: number): void {
  portsAnotherProcessTook.set(page, port);
}

export function takenPort(page: Page): number {
  const port = portsAnotherProcessTook.get(page);

  if (port === undefined) {
    throw new Error('no step took a port away from recompose');
  }

  return port;
}
