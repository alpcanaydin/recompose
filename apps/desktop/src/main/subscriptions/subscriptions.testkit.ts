import type { CustodyOutcome, KeychainItem, KeychainSeam } from './credential-custody';
import type { Clock } from './subscription-sign-in';

import { KeychainDenied, PARKED_SERVICE, VENDOR_SERVICE } from './credential-custody';

export const osUser = 'ada';

export type Refusal = { atStep: number; kind: 'denied' | 'failed' };

export type FakeKeychain = {
  seam: KeychainSeam;
  blobAt: (service: string, account: string) => string | null;
  holds: (service: string, account: string) => boolean;
  put: (service: string, account: string, blob: string) => void;
  writes: () => number;
  denyEverything: () => void;
};

function shelf(item: KeychainItem): string {
  return `${item.service} ${item.account}`;
}

export function refusalIn(outcome: CustodyOutcome): { code: string; message: string } {
  if (outcome.ok) {
    throw new Error('custody answered success where a refusal was expected');
  }

  return outcome;
}

export function vendorHolding(blob: string): Record<string, string> {
  return { [shelf({ service: VENDOR_SERVICE, account: osUser })]: blob };
}

export function parkedUnder(slot: string, blob: string): Record<string, string> {
  return { [shelf({ service: PARKED_SERVICE, account: slot })]: blob };
}

function refusalGate(refuse: Refusal | undefined) {
  let step = 0;
  let denying = false;

  return {
    denyEverything: (): void => {
      denying = true;
    },
    pass: (): void => {
      step += 1;

      if (denying) {
        throw new KeychainDenied('the keychain prompt was denied');
      }

      if (refuse?.atStep !== step) {
        return;
      }

      throw refuse.kind === 'denied'
        ? new KeychainDenied('the keychain prompt was denied')
        : new Error('the keychain is locked');
    },
  };
}

export function fakeKeychain(seeded: Record<string, string> = {}, refuse?: Refusal): FakeKeychain {
  const store = new Map(Object.entries(seeded));
  const gate = refusalGate(refuse);
  let writes = 0;

  return {
    seam: {
      read: async (item) => {
        gate.pass();

        return Promise.resolve(store.get(shelf(item)) ?? null);
      },
      write: async (item, blob) => {
        gate.pass();
        writes += 1;
        store.set(shelf(item), blob);

        return Promise.resolve();
      },
      remove: async (item) => {
        gate.pass();
        writes += 1;
        store.delete(shelf(item));

        return Promise.resolve();
      },
    },
    blobAt: (service, account) => store.get(shelf({ service, account })) ?? null,
    holds: (service, account) => store.has(shelf({ service, account })),
    put: (service, account, blob) => {
      store.set(shelf({ service, account }), blob);
    },
    writes: () => writes,
    denyEverything: gate.denyEverything,
  };
}

export function fakeClock(): Clock {
  let elapsed = 0;

  return {
    elapsed: () => elapsed,
    sleep: async (ms) => {
      elapsed += ms;

      return Promise.resolve();
    },
  };
}
