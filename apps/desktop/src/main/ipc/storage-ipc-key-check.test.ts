import { mkdtemp } from 'node:fs/promises';
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

async function freshContext(): Promise<StorageIpcContext> {
  const userDataPath = await mkdtemp(join(tmpdir(), 'recompose-ipc-key-check-'));

  return {
    userDataPath,
    homeFolder: '/Users/ada',
    getCodec: () => fakeCodec,
    isEncryptionAvailable: () => true,
    onCorrupt: () => undefined,
    applySettings: () => undefined,
    readLoginItem: () => false,
    startGateway: () => undefined,
    checkKey: async () => Promise.resolve({ verdict: 'could-not-check' as const }),
    releaseSubscription: subscriptionRelease(
      subscriptionHomes(userDataPath, process.platform),
      null,
    ),
  };
}

describe('storage ipc handlers: the key check before a probe stands', () => {
  test('a key check answers that it could not run, rather than guessing', async () => {
    const handlers = createStorageIpcHandlers(await freshContext());

    const answered = await handlers['accounts:check-key']({ id: 'acc-any' });

    expect(answered).toEqual({ ok: true, value: { verdict: 'could-not-check' } });
  });
});
