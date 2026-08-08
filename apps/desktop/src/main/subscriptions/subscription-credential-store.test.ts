import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';

import { credentialCustody, PARKED_SERVICE, VENDOR_SERVICE } from './credential-custody';
import { subscriptionCredentialStore } from './subscription-credential-store';
import { subscriptionHomes } from './subscription-homes';
import { fakeKeychain, osUser, parkedUnder, vendorHolding } from './subscriptions.testkit';

let userDataPath = '';

beforeEach(async () => {
  userDataPath = await mkdtemp(join(tmpdir(), 'recompose-subscription-credential-'));
});

async function record(provider: 'anthropic' | 'openai', id: string, blob: string): Promise<void> {
  const home = subscriptionHomes(userDataPath, 'linux').homeFor(provider, id);
  const name = provider === 'anthropic' ? '.credentials.json' : 'auth.json';

  await mkdir(home, { recursive: true });
  await writeFile(join(home, name), blob, 'utf8');
}

describe('reading a subscription credential for a serving turn', () => {
  test('Claude reads the credential file on a platform where Claude stores it in its home', async () => {
    await record('anthropic', 'acc-claude', 'claude-blob');

    const store = subscriptionCredentialStore(userDataPath, 'linux', null);

    await expect(store.read('anthropic', 'acc-claude')).resolves.toBe('claude-blob');
  });

  test('Codex reads auth.json from the selected account home on macOS too', async () => {
    await record('openai', 'acc-codex', 'codex-blob');

    const store = subscriptionCredentialStore(userDataPath, 'darwin', null);

    await expect(store.read('openai', 'acc-codex')).resolves.toBe('codex-blob');
  });

  test('an active Claude account on macOS reads the vendor keychain item', async () => {
    const homes = subscriptionHomes(userDataPath, 'darwin');
    const keychain = fakeKeychain(vendorHolding('active-blob'));

    await mkdir(homes.homeFor('anthropic', 'acc-active'), { recursive: true });
    await homes.pointActiveAt('anthropic', 'acc-active');

    const store = subscriptionCredentialStore(
      userDataPath,
      'darwin',
      credentialCustody(keychain.seam, osUser),
    );

    await expect(store.read('anthropic', 'acc-active')).resolves.toBe('active-blob');
  });

  test('an inactive Claude account on macOS reads its parked keychain item', async () => {
    const keychain = fakeKeychain(parkedUnder('acc-parked', 'parked-blob'));
    const store = subscriptionCredentialStore(
      userDataPath,
      'darwin',
      credentialCustody(keychain.seam, osUser),
    );

    await expect(store.read('anthropic', 'acc-parked')).resolves.toBe('parked-blob');
  });

  test('an account with no credential answers nothing', async () => {
    const store = subscriptionCredentialStore(userDataPath, 'linux', null);

    await expect(store.read('openai', 'acc-missing')).resolves.toBeNull();
  });
});

describe('persisting a refreshed subscription credential', () => {
  test('a refreshed file credential replaces the complete bundle', async () => {
    await record('openai', 'acc-codex', 'old-blob');
    const store = subscriptionCredentialStore(userDataPath, 'linux', null);

    await store.write('openai', 'acc-codex', 'new-blob');

    await expect(
      readFile(join(userDataPath, 'subscriptions', 'openai', 'acc-codex', 'auth.json'), 'utf8'),
    ).resolves.toBe('new-blob');
  });

  test('a refreshed active Claude credential replaces the vendor item', async () => {
    const homes = subscriptionHomes(userDataPath, 'darwin');
    const keychain = fakeKeychain(vendorHolding('old-blob'));

    await mkdir(homes.homeFor('anthropic', 'acc-active'), { recursive: true });
    await homes.pointActiveAt('anthropic', 'acc-active');
    const store = subscriptionCredentialStore(
      userDataPath,
      'darwin',
      credentialCustody(keychain.seam, osUser),
    );

    await store.write('anthropic', 'acc-active', 'new-blob');

    expect(keychain.blobAt(VENDOR_SERVICE, osUser)).toBe('new-blob');
  });

  test('a refreshed inactive Claude credential leaves the active item untouched', async () => {
    const keychain = fakeKeychain({
      ...vendorHolding('active-blob'),
      ...parkedUnder('acc-parked', 'old-blob'),
    });
    const store = subscriptionCredentialStore(
      userDataPath,
      'darwin',
      credentialCustody(keychain.seam, osUser),
    );

    await store.write('anthropic', 'acc-parked', 'new-blob');

    expect(keychain.blobAt(PARKED_SERVICE, 'acc-parked')).toBe('new-blob');
    expect(keychain.blobAt(VENDOR_SERVICE, osUser)).toBe('active-blob');
  });
});

describe('a Gemini (Antigravity) subscription credential', () => {
  test('a refreshed Antigravity credential is written to antigravity.json', async () => {
    const store = subscriptionCredentialStore(userDataPath, 'linux', null);

    await store.write('antigravity', 'acc-gemini', 'gemini-blob');

    await expect(
      readFile(
        join(userDataPath, 'subscriptions', 'antigravity', 'acc-gemini', 'antigravity.json'),
        'utf8',
      ),
    ).resolves.toBe('gemini-blob');
  });

  test('an Antigravity account reads its credential back from that same file', async () => {
    const home = join(userDataPath, 'subscriptions', 'antigravity', 'acc-gemini');

    await mkdir(home, { recursive: true });
    await writeFile(join(home, 'antigravity.json'), 'gemini-blob', 'utf8');
    const store = subscriptionCredentialStore(userDataPath, 'linux', null);

    await expect(store.read('antigravity', 'acc-gemini')).resolves.toBe('gemini-blob');
  });
});

describe('a subscription credential the store cannot reach', () => {
  test('a credential the filesystem refuses to read is surfaced, not reported as absent', async () => {
    await mkdir(join(userDataPath, 'subscriptions', 'openai', 'acc-blocked', 'auth.json'), {
      recursive: true,
    });
    const store = subscriptionCredentialStore(userDataPath, 'linux', null);

    await expect(store.read('openai', 'acc-blocked')).rejects.toThrow();
  });

  test('a Claude account on macOS without keychain custody has no credential to read', async () => {
    const store = subscriptionCredentialStore(userDataPath, 'darwin', null);

    await expect(store.read('anthropic', 'acc-claude')).resolves.toBeNull();
  });

  test('a refreshed Claude credential on macOS refuses to be written without keychain custody', async () => {
    const store = subscriptionCredentialStore(userDataPath, 'darwin', null);

    await expect(store.write('anthropic', 'acc-claude', 'new-blob')).rejects.toThrow(
      'Claude credential custody is unavailable',
    );
  });
});
