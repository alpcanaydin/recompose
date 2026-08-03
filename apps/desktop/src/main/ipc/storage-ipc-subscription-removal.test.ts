import { ACCOUNTS_VERSION, type SubscriptionAccount } from '@recompose/contracts';
import { lstat, mkdtemp, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { SecretCodec } from '../storage/safe-storage-codec';
import type { SubscriptionHomes } from '../subscriptions/subscription-homes';
import type { StorageIpcContext } from './storage-context';

import { loadAccountsFile } from '../storage/accounts-store';
import { loadVaultFile } from '../storage/vault';
import { subscriptionHomes } from '../subscriptions/subscription-homes';
import { subscriptionRelease } from '../subscriptions/subscription-release';
import { createStorageIpcHandlers } from './storage-ipc';
import { createSubscriptionsIpcHandlers } from './subscriptions-ipc';
import { aFreshWorld, claudeCodeSignedIn } from './subscriptions-ipc.testkit';

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

function contextOver(userDataPath: string): StorageIpcContext {
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

async function freshContext(): Promise<StorageIpcContext> {
  return contextOver(await mkdtemp(join(tmpdir(), 'recompose-ipc-release-')));
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
  const accountsFile = join(ctx.userDataPath, 'accounts.json');

  for (const row of rows) {
    await homes.resetPending(row.provider);
    await homes.promotePending(row.provider, row.id);
  }

  const held = await loadAccountsFile(accountsFile, () => undefined);

  await writeFile(
    accountsFile,
    JSON.stringify({ schemaVersion: ACCOUNTS_VERSION, accounts: [...held.accounts, ...rows] }),
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

    expect(removed).toEqual({ ok: true, value: { schemaVersion: 3, accounts: [] } });
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

describe('the registry survives a removal racing a sign-in', () => {
  test('given a removal parked on custody, the sign-in that lands meanwhile stays held', async () => {
    const world = await aFreshWorld();

    await world.toolInstalled('claude');

    const subsCtx = world.contextOn(
      'linux',
      world.toolSigningIn(
        world.homesOn('linux'),
        'anthropic',
        claudeCodeSignedIn('grace@ex.com', 'max'),
      ),
    );
    const subscriptions = createSubscriptionsIpcHandlers(subsCtx);

    await world.alreadyHolding([aSubscriptionRow('acc-one', 'anthropic')]);

    let custodyReached = (): void => undefined;
    const reached = new Promise<void>((resolve) => {
      custodyReached = resolve;
    });
    let releaseTheCustody = (): void => undefined;
    const parkedOnThePrompt = new Promise<void>((resolve) => {
      releaseTheCustody = resolve;
    });
    const storage = createStorageIpcHandlers({
      ...contextOver(subsCtx.userDataPath),
      releaseSubscription: async (row, survivors) => {
        custodyReached();
        await parkedOnThePrompt;

        return subscriptionRelease(homesUnder(subsCtx.userDataPath), null)(row, survivors);
      },
    });

    const removing = storage['accounts:remove']({ id: 'acc-one' });

    await reached;
    await subscriptions['subscriptions:sign-in']({ provider: 'anthropic' });
    releaseTheCustody();
    await removing;

    const held = await loadAccountsFile(
      join(subsCtx.userDataPath, 'accounts.json'),
      () => undefined,
    );

    expect(held.accounts.map((row) => row.label)).toEqual(['grace@ex.com']);
  });
});

describe('a removal the custody refuses', () => {
  test('given a refused release, the removal answers the refusal and the row stays held', async () => {
    const ctx = await freshContext();

    await withHomes(ctx, [aSubscriptionRow('acc-one', 'anthropic')]);

    const handlers = createStorageIpcHandlers({
      ...ctx,
      releaseSubscription: async () =>
        Promise.resolve({
          ok: false as const,
          code: 'keychain-denied' as const,
          message: 'the person pressed Deny.',
        }),
    });

    const removed = await handlers['accounts:remove']({ id: 'acc-one' });
    const held = await loadAccountsFile(join(ctx.userDataPath, 'accounts.json'), () => undefined);

    expect(removed.ok).toBe(false);
    expect(held.accounts.map((row) => row.id)).toEqual(['acc-one']);
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
