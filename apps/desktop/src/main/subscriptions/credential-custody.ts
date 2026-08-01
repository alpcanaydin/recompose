import type { SubscriptionProviderId } from '@recompose/contracts';

import { oneAtATime } from '../storage/one-at-a-time';

export const VENDOR_SERVICE = 'Claude Code-credentials';
export const PARKED_SERVICE = 'recompose-parked-credentials';
export const RESERVED_SLOT = 'login-before-recompose';

export type KeychainItem = { service: string; account: string };

export type KeychainSeam = {
  read: (item: KeychainItem) => Promise<string | null>;
  write: (item: KeychainItem, blob: string) => Promise<void>;
  remove: (item: KeychainItem) => Promise<void>;
};

export class KeychainDenied extends Error {}

export type CustodyOutcome =
  | { ok: true }
  | { ok: false; code: 'keychain-denied' | 'storage-failed'; message: string };

export type CredentialCustody = {
  park: (slot: string) => Promise<CustodyOutcome>;
  place: (slot: string) => Promise<CustodyOutcome>;
  handOver: (outgoing: string | null, incoming: string) => Promise<CustodyOutcome>;
  forget: (slot: string) => Promise<CustodyOutcome>;
  clear: () => Promise<CustodyOutcome>;
  parkedStands: (slot: string) => Promise<boolean>;
  vendorStands: () => Promise<boolean>;
};

export function custodyOver(
  custody: CredentialCustody | null,
  provider: SubscriptionProviderId,
): CredentialCustody | null {
  return provider === 'anthropic' ? custody : null;
}

function refusal(step: string, subject: string, cause: unknown): CustodyOutcome {
  const why = cause instanceof Error ? cause.message : String(cause);

  return {
    ok: false,
    code: cause instanceof KeychainDenied ? 'keychain-denied' : 'storage-failed',
    message: `custody could not ${step} the subscription credential for ${subject}: ${why}`,
  };
}

async function attempt(
  step: string,
  subject: string,
  work: () => Promise<void>,
): Promise<CustodyOutcome> {
  try {
    await work();

    return { ok: true };
  } catch (cause) {
    return refusal(step, subject, cause);
  }
}

export function credentialCustody(keychain: KeychainSeam, osUser: string): CredentialCustody {
  const lane = oneAtATime();
  const vendorItem: KeychainItem = { service: VENDOR_SERVICE, account: osUser };
  const parkedItem = (slot: string): KeychainItem => ({ service: PARKED_SERVICE, account: slot });

  const stands = async (item: KeychainItem): Promise<boolean> =>
    keychain.read(item).then(
      (held) => held !== null,
      () => false,
    );

  const parkInto = async (slot: string): Promise<void> => {
    const held = await keychain.read(vendorItem);

    if (held !== null) {
      await keychain.write(parkedItem(slot), held);
    }
  };

  const placeFrom = async (slot: string): Promise<void> => {
    const held = await keychain.read(parkedItem(slot));

    if (held === null) {
      await keychain.remove(vendorItem);

      return;
    }

    await keychain.write(vendorItem, held);
  };

  return {
    park: async (slot) => lane(async () => attempt('park', slot, async () => parkInto(slot))),

    place: async (slot) => lane(async () => attempt('place', slot, async () => placeFrom(slot))),

    handOver: async (outgoing, incoming) =>
      lane(async () => {
        const slot = outgoing ?? RESERVED_SLOT;
        const parked = await attempt('park', slot, async () => parkInto(slot));

        return parked.ok ? attempt('place', incoming, async () => placeFrom(incoming)) : parked;
      }),

    forget: async (slot) =>
      lane(async () => attempt('forget', slot, async () => keychain.remove(parkedItem(slot)))),

    clear: async () =>
      lane(async () =>
        attempt('clear', 'the active account', async () => keychain.remove(vendorItem)),
      ),

    parkedStands: async (slot) => lane(async () => stands(parkedItem(slot))),

    vendorStands: async () => lane(async () => stands(vendorItem)),
  };
}
