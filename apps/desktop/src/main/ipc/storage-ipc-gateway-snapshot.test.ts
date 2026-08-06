import {
  ACCOUNTS_VERSION,
  GATEWAY_CONFIG_VERSION,
  type Account,
  type EngineGateway,
  type GatewayConfig,
} from '@recompose/contracts';
import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { SecretCodec } from '../storage/safe-storage-codec';
import type { StorageIpcContext } from './storage-context';

import { keyRow, planRow } from '../engine-host/spend-grant.testkit';
import { createStorageIpcHandlers } from './storage-ipc';

const fakeCodec: SecretCodec = {
  encrypt: (plain) => Buffer.from(plain, 'utf8').toString('base64'),
  decrypt: (encrypted) => Buffer.from(encrypted, 'base64').toString('utf8'),
  isPlaintextFallback: false,
};

const personal: GatewayConfig = {
  schemaVersion: GATEWAY_CONFIG_VERSION,
  slug: 'personal',
  displayName: 'Personal',
  port: 8397,
  virtualModels: [
    {
      id: 'fast',
      displayName: 'fast',
      target: { accountId: keyRow.id, providerModel: 'claude-sonnet-5' },
    },
  ],
  layout: { nodes: {} },
};

async function contextHolding(
  started: EngineGateway[],
  registry: unknown,
): Promise<StorageIpcContext> {
  const userDataPath = await mkdtemp(join(tmpdir(), 'recompose-snapshot-'));

  await writeFile(join(userDataPath, 'accounts.json'), JSON.stringify(registry), 'utf8');

  return {
    userDataPath,
    homeFolder: '/Users/ada',
    getCodec: () => fakeCodec,
    isEncryptionAvailable: () => true,
    onCorrupt: () => undefined,
    applySettings: () => undefined,
    readLoginItem: () => false,
    startGateway: (gateway) => {
      started.push(gateway);
    },
    releaseSubscription: async () => Promise.resolve({ ok: true }),
  };
}

async function contextFor(started: EngineGateway[], accounts: readonly Account[]) {
  return contextHolding(started, { schemaVersion: ACCOUNTS_VERSION, accounts });
}

async function storedSlugs(userDataPath: string): Promise<string[]> {
  return readdir(join(userDataPath, 'gateways'));
}

describe('the snapshot a gateway serves under the moment it is saved', () => {
  test('a target the registry still holds serves bound to the stored model name', async () => {
    const started: EngineGateway[] = [];
    const handlers = createStorageIpcHandlers(await contextFor(started, [keyRow]));

    await handlers['gateways:save'](personal);

    expect(started[0]?.virtualModels).toStrictEqual([
      {
        id: 'fast',
        displayName: 'fast',
        target: { standing: 'bound', providerModel: 'claude-sonnet-5' },
      },
    ]);
  });

  test('a target the registry never held serves removed', async () => {
    const started: EngineGateway[] = [];
    const handlers = createStorageIpcHandlers(await contextFor(started, []));

    await handlers['gateways:save'](personal);

    expect(started[0]?.virtualModels).toStrictEqual([
      { id: 'fast', displayName: 'fast', target: { standing: 'removed' } },
    ]);
  });

  test('a target that turned out to be a subscription serves removed', async () => {
    const started: EngineGateway[] = [];
    const handlers = createStorageIpcHandlers(
      await contextFor(started, [{ ...planRow, id: keyRow.id }]),
    );

    await handlers['gateways:save'](personal);

    expect(started[0]?.virtualModels).toStrictEqual([
      { id: 'fast', displayName: 'fast', target: { standing: 'removed' } },
    ]);
  });
});

describe('a save whose registry cannot be read', () => {
  test('the save is refused as a newer registry rather than serving a guess', async () => {
    const started: EngineGateway[] = [];
    const handlers = createStorageIpcHandlers(
      await contextHolding(started, { schemaVersion: ACCOUNTS_VERSION + 1, accounts: [] }),
    );

    const answer = await handlers['gateways:save'](personal);

    expect(answer).toMatchObject({ ok: false, error: { code: 'accounts-newer-schema' } });
    expect(started).toStrictEqual([]);
  });

  test('a refused save leaves no gateway document behind', async () => {
    const started: EngineGateway[] = [];
    const context = await contextHolding(started, {
      schemaVersion: ACCOUNTS_VERSION + 1,
      accounts: [],
    });

    await createStorageIpcHandlers(context)['gateways:save'](personal);

    await expect(storedSlugs(context.userDataPath)).resolves.toStrictEqual([]);
  });
});
