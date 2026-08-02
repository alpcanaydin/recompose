import { test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { credentialCustody } from './credential-custody';
import { fakeKeychain, osUser, parkedUnder, vendorHolding } from './subscriptions.testkit';

describe('whether a credential stands, answered from attributes alone', () => {
  test('given a slot that holds a credential, the parked item stands', async () => {
    const keychain = fakeKeychain(parkedUnder('acc-one', 'opaque-one'));
    const custody = credentialCustody(keychain.seam, osUser);

    await expect(custody.parkedStands('acc-one')).resolves.toBe(true);
    await expect(custody.parkedStands('acc-two')).resolves.toBe(false);
  });

  test('given the tool holding a credential, the vendor item stands, and once emptied it does not', async () => {
    const keychain = fakeKeychain(vendorHolding('opaque-one'));
    const custody = credentialCustody(keychain.seam, osUser);

    await expect(custody.vendorStands()).resolves.toBe(true);

    await custody.clear();

    await expect(custody.vendorStands()).resolves.toBe(false);
  });

  test('given a keychain that cannot say whether the item exists, the slot reads as empty rather than throwing', async () => {
    const keychain = fakeKeychain(parkedUnder('acc-one', 'opaque-one'));
    const custody = credentialCustody(keychain.seam, osUser);

    keychain.failPresence();

    await expect(custody.parkedStands('acc-one')).resolves.toBe(false);
  });

  test('given every secret prompt denied, a parked credential still stands', async () => {
    const keychain = fakeKeychain(parkedUnder('acc-one', 'opaque-one'));
    const custody = credentialCustody(keychain.seam, osUser);

    keychain.denyEverything();

    await expect(custody.parkedStands('acc-one')).resolves.toBe(true);
  });

  test('given every secret prompt denied, the vendor item still stands, so watching standing never asks for the secret', async () => {
    const keychain = fakeKeychain(vendorHolding('opaque-one'));
    const custody = credentialCustody(keychain.seam, osUser);

    keychain.denyEverything();

    await expect(custody.vendorStands()).resolves.toBe(true);
  });
});
