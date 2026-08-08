import { ACCOUNTS_VERSION, GATEWAY_CONFIG_VERSION, type GatewayConfig } from '@recompose/contracts';
import { vi } from 'vitest';

export const EVENT_DRIVEN_TIMEOUT = 20000;

/**
 * Repeat a write until the watcher answers it.
 *
 * @summary macOS keeps one shared event stream per process and rebuilds it whenever a watcher
 * joins, dropping whatever changed during the rebuild. A spec that wrote once would be asserting
 * that the first event after boot always survives, which is the operating system's promise to
 * make rather than the wiring's. Writing the same document again costs nothing, because the
 * watcher compares content: a repeat that lands after the first one reports no second change.
 */
export async function untilNoticed(
  write: () => Promise<void>,
  expectation: () => void,
): Promise<void> {
  await vi.waitFor(
    async () => {
      await write();
      expectation();
    },
    { interval: 150, timeout: 5000 },
  );
}

export async function untilSettled(expectation: () => void): Promise<void> {
  await vi.waitFor(expectation, { interval: 20, timeout: 5000 });
}

export async function longEnoughForAReaction(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 400);
  });
}

export function accountsDocument(label: string): string {
  return JSON.stringify({
    schemaVersion: ACCOUNTS_VERSION,
    accounts: [
      {
        id: 'account-1',
        kind: 'api-key',
        provider: 'openai',
        label,
        credentialRef: 'vault-account-1',
      },
    ],
  });
}

export function gatewayDocument(slug: string, displayName: string): GatewayConfig {
  return {
    schemaVersion: GATEWAY_CONFIG_VERSION,
    slug,
    displayName,
    port: 8397,
    virtualModels: [],
    layout: { nodes: {} },
  };
}
