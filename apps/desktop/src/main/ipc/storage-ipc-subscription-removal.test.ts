import { ACCOUNTS_VERSION, type SubscriptionAccount } from '@recompose/contracts';
import { lstat, mkdtemp, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { SecretCodec } from '../storage/safe-storage-codec';
import type { SubscriptionHomes } from '../subscriptions/subscription-homes';
import type { StorageIpcContext } from './storage-context';

import { loadVaultFile } from '../storage/vault';
import { subscriptionHomes } from '../subscriptions/subscription-homes';
import { subscriptionRelease } from '../subscriptions/subscription-release';
import { createStorageIpcHandlers } from './storage-ipc';

const fakeCodec: SecretCodec = {
  encrypt: (plain) => Buffer.from(plain, 'utf8').toString('base64'),
  decrypt: (encrypted) => Buffer.from(encrypted, 'base64').toString('utf8'),
  isPlaintextFallback: false,
};

const connectRequest = {
  provider: 'anthropic',
  kind: 'api-key' as const,
  label: 'Work key',
  secret: 'sk-verysecret',
};

function homesUnder(userDataPath: string): SubscriptionHomes {
  return subscriptionHomes(userDataPath, process.platform);
}

async function freshContext(): Promise<StorageIpcContext> {
  const userDataPath = await mkdtemp(join(tmpdir(), 'recompose-ipc-release-'));

  return {
    userDataPath,
    homeFolder: '/Users/ada',
    getCodec: () => fakeCodec,
    isEncryptionAvailable: () => true,
    onCorrupt: () => undefined,
    applySettings: () => undefined,
    readLoginItem: () => false,
    startGateway: () => undefined,
    releaseSubscription: subscriptionRelease(homesUnder(userDataPath), null),
  };
}

function aSubscriptionRow(
  id: string,
  provider: SubscriptionAccount['provider'],
): SubscriptionAccount {
  return { id, provider, kind: 'subscription', label: `Ada on ${provider}` };
}

async function withHomes(
  ctx: StorageIpcContext,
  rows: readonly SubscriptionAccount[],
): Promise<SubscriptionHomes> {
  const homes = homesUnder(ctx.userDataPath);

  for (const row of rows) {
    await homes.resetPending(row.provider);
    await homes.promotePending(row.provider, row.id);
  }

  await writeFile(
    join(ctx.userDataPath, 'accounts.json'),
    JSON.stringify({ schemaVersion: ACCOUNTS_VERSION, accounts: rows }),
    'utf8',
  );

  return homes;
}

async function stands(folder: string): Promise<boolean> {
  return stat(folder).then(
    () => true,
    () => false,
  );
}

async function pointerStands(pointer: string): Promise<boolean> {
  return lstat(pointer).then(
    () => true,
    () => false,
  );
}

describe('storage ipc handlers: removing a subscription account', () => {
  test('given a subscription row leaving, its config home goes with it', async () => {
    const ctx = await freshContext();
    const homes = await withHomes(ctx, [aSubscriptionRow('acc-one', 'anthropic')]);
    const handlers = createStorageIpcHandlers(ctx);

    const removed = await handlers['accounts:remove']({ id: 'acc-one' });

    expect(removed).toEqual({ ok: true, value: { schemaVersion: 2, accounts: [] } });
    await expect(stands(homes.homeFor('anthropic', 'acc-one'))).resolves.toBe(false);
  });

  test('given the pointed-at row leaving, the pointer moves to a survivor of the same provider', async () => {
    const ctx = await freshContext();
    const homes = await withHomes(ctx, [
      aSubscriptionRow('acc-one', 'anthropic'),
      aSubscriptionRow('acc-two', 'anthropic'),
    ]);

    await homes.pointActiveAt('anthropic', 'acc-one');

    await createStorageIpcHandlers(ctx)['accounts:remove']({ id: 'acc-one' });

    await expect(homes.readActive('anthropic')).resolves.toBe('acc-two');
  });

  test('given only another provider left, the pointer is left standing at nobody', async () => {
    const ctx = await freshContext();
    const homes = await withHomes(ctx, [
      aSubscriptionRow('acc-one', 'anthropic'),
      aSubscriptionRow('acc-two', 'openai'),
    ]);

    await homes.pointActiveAt('anthropic', 'acc-one');

    await createStorageIpcHandlers(ctx)['accounts:remove']({ id: 'acc-one' });

    await expect(pointerStands(homes.activePointerFor('anthropic'))).resolves.toBe(false);
    await expect(homes.readActive('anthropic')).resolves.toBeNull();
    await expect(stands(homes.homeFor('openai', 'acc-two'))).resolves.toBe(true);
  });

  test('given a subscription row leaving, the vault another account depends on is left whole', async () => {
    const ctx = await freshContext();
    const handlers = createStorageIpcHandlers(ctx);
    const connected = await handlers['accounts:connect'](connectRequest);

    if (!connected.ok) {
      throw new Error('the pasted key was never stored, so nothing stands to be left whole');
    }

    await withHomes(ctx, [aSubscriptionRow('acc-one', 'anthropic')]);
    await handlers['accounts:remove']({ id: 'acc-one' });

    const vault = await loadVaultFile(join(ctx.userDataPath, 'vault.bin'), () => undefined);

    expect(Object.keys(vault.entries)).toHaveLength(1);
  });
});

describe('storage ipc handlers: removing an id nobody holds', () => {
  test('given an id that matches no row, every home is left standing', async () => {
    const ctx = await freshContext();
    const homes = await withHomes(ctx, [aSubscriptionRow('acc-one', 'anthropic')]);

    await createStorageIpcHandlers(ctx)['accounts:remove']({ id: 'ghost' });

    await expect(stands(homes.homeFor('anthropic', 'acc-one'))).resolves.toBe(true);
  });
});
