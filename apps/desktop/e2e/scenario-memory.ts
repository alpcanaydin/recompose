import type { Page } from '@playwright/test';

const gatewaysInFocus = new WeakMap<Page, string>();

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
