import type { SubscriptionAccount } from '@recompose/contracts';

import { mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';

import type { FakeKeychain } from './subscriptions.testkit';

import {
  credentialCustody,
  PARKED_SERVICE,
  RESERVED_SLOT,
  VENDOR_SERVICE,
} from './credential-custody';
import { subscriptionHomes, type SubscriptionHomes } from './subscription-homes';
import { subscriptionRelease } from './subscription-release';
import { fakeKeychain, osUser } from './subscriptions.testkit';

let userDataPath: string;
let homes: SubscriptionHomes;
let keychain: FakeKeychain;

function anAccount(id: string, provider: SubscriptionAccount['provider']): SubscriptionAccount {
  return { id, provider, kind: 'subscription', label: 'Ada' };
}

async function homeExists(provider: SubscriptionAccount['provider'], id: string): Promise<boolean> {
  return stat(homes.homeFor(provider, id)).then(
    () => true,
    () => false,
  );
}

async function anAccountWithAHome(provider: SubscriptionAccount['provider'], id: string) {
  await homes.resetPending(provider);
  await homes.promotePending(provider, id);
}

beforeEach(async () => {
  userDataPath = await mkdtemp(join(tmpdir(), 'recompose-release-'));
  homes = subscriptionHomes(userDataPath, process.platform);
  keychain = fakeKeychain();
});

describe('letting go of a subscription account', () => {
  test('given an account leaving, its config home goes with it', async () => {
    await anAccountWithAHome('anthropic', 'acc-one');
    const release = subscriptionRelease(homes, null);

    await release(anAccount('acc-one', 'anthropic'), []);

    await expect(homeExists('anthropic', 'acc-one')).resolves.toBe(false);
  });

  test('given the account the pointer stood at leaving, the pointer moves to a survivor', async () => {
    await anAccountWithAHome('anthropic', 'acc-one');
    await anAccountWithAHome('anthropic', 'acc-two');
    await homes.pointActiveAt('anthropic', 'acc-one');
    const release = subscriptionRelease(homes, null);

    await release(anAccount('acc-one', 'anthropic'), ['acc-two']);

    await expect(homes.readActive('anthropic')).resolves.toBe('acc-two');
  });

  test('given the last account leaving, no pointer is left dangling', async () => {
    await anAccountWithAHome('anthropic', 'acc-one');
    await homes.pointActiveAt('anthropic', 'acc-one');
    const release = subscriptionRelease(homes, null);

    await release(anAccount('acc-one', 'anthropic'), []);

    await expect(homes.readActive('anthropic')).resolves.toBeNull();
  });

  test('given another account leaving, the pointer stays where it stood', async () => {
    await anAccountWithAHome('anthropic', 'acc-one');
    await anAccountWithAHome('anthropic', 'acc-two');
    await homes.pointActiveAt('anthropic', 'acc-one');
    const release = subscriptionRelease(homes, null);

    await release(anAccount('acc-two', 'anthropic'), ['acc-one']);

    await expect(homes.readActive('anthropic')).resolves.toBe('acc-one');
  });
});

describe('letting go of the credential a leaving account kept in the keychain', () => {
  test('given an account leaving, its parked credential goes with it', async () => {
    await anAccountWithAHome('anthropic', 'acc-one');
    await anAccountWithAHome('anthropic', 'acc-two');
    keychain.put(PARKED_SERVICE, 'acc-one', 'blob-one');
    const release = subscriptionRelease(homes, credentialCustody(keychain.seam, osUser));

    await release(anAccount('acc-one', 'anthropic'), ['acc-two']);

    expect(keychain.blobAt(PARKED_SERVICE, 'acc-one')).toBeNull();
  });

  test('given the active account leaving, the survivor the pointer moved to takes the vendor item', async () => {
    await anAccountWithAHome('anthropic', 'acc-one');
    await anAccountWithAHome('anthropic', 'acc-two');
    await homes.pointActiveAt('anthropic', 'acc-one');
    keychain.put(VENDOR_SERVICE, osUser, 'blob-one');
    keychain.put(PARKED_SERVICE, 'acc-two', 'blob-two');
    const release = subscriptionRelease(homes, credentialCustody(keychain.seam, osUser));

    await release(anAccount('acc-one', 'anthropic'), ['acc-two']);

    expect(keychain.blobAt(VENDOR_SERVICE, osUser)).toBe('blob-two');
  });

  test('given the last account leaving, the login that stood before recompose comes back', async () => {
    await anAccountWithAHome('anthropic', 'acc-one');
    await homes.pointActiveAt('anthropic', 'acc-one');
    keychain.put(VENDOR_SERVICE, osUser, 'blob-one');
    keychain.put(PARKED_SERVICE, RESERVED_SLOT, 'someone-elses-login');
    const release = subscriptionRelease(homes, credentialCustody(keychain.seam, osUser));

    await release(anAccount('acc-one', 'anthropic'), []);

    expect(keychain.blobAt(VENDOR_SERVICE, osUser)).toBe('someone-elses-login');
  });

  test('given an account that was never active leaving, the vendor item is left alone', async () => {
    await anAccountWithAHome('anthropic', 'acc-one');
    await anAccountWithAHome('anthropic', 'acc-two');
    await homes.pointActiveAt('anthropic', 'acc-one');
    keychain.put(VENDOR_SERVICE, osUser, 'blob-one');
    const release = subscriptionRelease(homes, credentialCustody(keychain.seam, osUser));

    await release(anAccount('acc-two', 'anthropic'), ['acc-one']);

    expect(keychain.blobAt(VENDOR_SERVICE, osUser)).toBe('blob-one');
  });

  test('given a Codex account leaving, the keychain is never touched, because Codex never used it', async () => {
    await anAccountWithAHome('openai', 'acc-one');
    await homes.pointActiveAt('openai', 'acc-one');
    keychain.put(VENDOR_SERVICE, osUser, 'blob-one');
    const release = subscriptionRelease(homes, credentialCustody(keychain.seam, osUser));

    await release(anAccount('acc-one', 'openai'), []);

    expect(keychain.blobAt(VENDOR_SERVICE, osUser)).toBe('blob-one');
    await expect(homeExists('openai', 'acc-one')).resolves.toBe(false);
  });
});
