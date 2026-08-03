import { ACCOUNTS_VERSION } from '@recompose/contracts';
import { mkdtemp, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { SecretCodec } from '../storage/safe-storage-codec';
import type { StorageIpcContext } from './storage-context';

import { subscriptionHomes } from '../subscriptions/subscription-homes';
import { subscriptionRelease } from '../subscriptions/subscription-release';
import { createStorageIpcHandlers } from './storage-ipc';

const fakeCodec: SecretCodec = {
  encrypt: (plain) => Buffer.from(plain, 'utf8').toString('base64'),
  decrypt: (encrypted) => Buffer.from(encrypted, 'base64').toString('utf8'),
  isPlaintextFallback: false,
};

const runtimeRow = {
  id: 'acc-ollama',
  provider: 'ollama',
  kind: 'local',
  address: 'http://127.0.0.1:11434',
};

async function holdingOnlyTheRuntime(): Promise<StorageIpcContext> {
  const userDataPath = await mkdtemp(join(tmpdir(), 'recompose-ipc-local-'));

  await writeFile(
    join(userDataPath, 'accounts.json'),
    JSON.stringify({ schemaVersion: ACCOUNTS_VERSION, accounts: [runtimeRow] }),
    'utf8',
  );

  return {
    userDataPath,
    homeFolder: '/Users/ada',
    getCodec: () => fakeCodec,
    isEncryptionAvailable: () => true,
    onCorrupt: () => undefined,
    applySettings: () => undefined,
    readLoginItem: () => false,
    startGateway: () => undefined,
    releaseSubscription: subscriptionRelease(
      subscriptionHomes(userDataPath, process.platform),
      null,
    ),
  };
}

describe('storage ipc handlers: removing a local runtime row', () => {
  test('the row leaves the registry, and the vault file is never created', async () => {
    const ctx = await holdingOnlyTheRuntime();

    const removed = await createStorageIpcHandlers(ctx)['accounts:remove']({ id: runtimeRow.id });

    expect(removed).toEqual({ ok: true, value: { schemaVersion: ACCOUNTS_VERSION, accounts: [] } });
    await expect(stat(join(ctx.userDataPath, 'vault.bin'))).rejects.toThrow();
  });
});
