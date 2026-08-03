import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { SecretCodec } from '../storage/safe-storage-codec';
import type { StorageIpcContext } from './storage-context';

import { createStorageIpcHandlers } from './storage-ipc';

const fakeCodec: SecretCodec = {
  encrypt: (plain) => Buffer.from(plain, 'utf8').toString('base64'),
  decrypt: (encrypted) => Buffer.from(encrypted, 'base64').toString('utf8'),
  isPlaintextFallback: false,
};

async function freshContext(): Promise<StorageIpcContext> {
  const userDataPath = await mkdtemp(join(tmpdir(), 'recompose-ipc-key-connect-'));

  return {
    userDataPath,
    homeFolder: '/Users/ada',
    getCodec: () => fakeCodec,
    isEncryptionAvailable: () => true,
    onCorrupt: () => undefined,
    applySettings: () => undefined,
    readLoginItem: () => false,
    startGateway: () => undefined,
    releaseSubscription: async () => Promise.resolve({ ok: true }),
  };
}

function keyRequest(provider: string, label: string, secret = 'sk-ant-api03-long-secret-7f2c') {
  return { provider, kind: 'api-key' as const, label, secret };
}

async function vaultBytes(ctx: StorageIpcContext): Promise<string> {
  return readFile(join(ctx.userDataPath, 'vault.bin'), 'utf8');
}

describe('storage ipc handlers: a name stands once per provider', () => {
  test('a connect whose name the same provider already holds refuses with name-conflict', async () => {
    const handlers = createStorageIpcHandlers(await freshContext());

    await handlers['accounts:connect'](keyRequest('anthropic', 'build'));

    const refused = await handlers['accounts:connect'](keyRequest('anthropic', 'build'));

    expect(refused).toMatchObject({ ok: false, error: { code: 'name-conflict' } });

    if (refused.ok) {
      throw new Error('expected a refusal');
    }

    expect(refused.error.message).toContain('build');
  });

  test('a refused connect leaves the vault untouched', async () => {
    const ctx = await freshContext();
    const handlers = createStorageIpcHandlers(ctx);

    await handlers['accounts:connect'](keyRequest('anthropic', 'build'));

    const before = await vaultBytes(ctx);

    await handlers['accounts:connect'](
      keyRequest('anthropic', 'build', 'sk-ant-api03-refused-9z8y'),
    );

    expect(await vaultBytes(ctx)).toBe(before);
  });
});

describe('storage ipc handlers: the scope of the name guard', () => {
  test('two providers may each hold a key of the same name', async () => {
    const handlers = createStorageIpcHandlers(await freshContext());

    await handlers['accounts:connect'](keyRequest('anthropic', 'build'));

    const connected = await handlers['accounts:connect'](keyRequest('openai', 'build'));

    expect(connected).toMatchObject({ ok: true });

    if (!connected.ok) {
      throw new Error('expected success');
    }

    expect(connected.value.accounts).toHaveLength(2);
  });

  test('a different name under the same provider connects', async () => {
    const handlers = createStorageIpcHandlers(await freshContext());

    await handlers['accounts:connect'](keyRequest('anthropic', 'build'));

    const connected = await handlers['accounts:connect'](keyRequest('anthropic', 'deploy'));

    expect(connected).toMatchObject({ ok: true });
  });

  test('a subscription under the provider never blocks a key name', async () => {
    const ctx = await freshContext();

    await writeFile(
      join(ctx.userDataPath, 'accounts.json'),
      JSON.stringify({
        schemaVersion: 3,
        accounts: [{ id: 'sub-one', provider: 'anthropic', kind: 'subscription', label: 'build' }],
      }),
      'utf8',
    );

    const connected = await createStorageIpcHandlers(ctx)['accounts:connect'](
      keyRequest('anthropic', 'build'),
    );

    expect(connected).toMatchObject({ ok: true });
  });
});

describe('storage ipc handlers: the stored row carries the tail', () => {
  test('a connect that stands mints the tail from the trimmed key', async () => {
    const handlers = createStorageIpcHandlers(await freshContext());

    const connected = await handlers['accounts:connect'](
      keyRequest('anthropic', 'build', 'sk-ant-api03-long-secret-7f2c'),
    );

    if (!connected.ok) {
      throw new Error('expected success');
    }

    expect(connected.value.accounts[0]).toMatchObject({ keyTail: '7f2c' });
  });

  test('a secret too short to publish a tail stores a row without one', async () => {
    const handlers = createStorageIpcHandlers(await freshContext());

    const connected = await handlers['accounts:connect'](
      keyRequest('anthropic', 'build', 'tiny-key'),
    );

    if (!connected.ok) {
      throw new Error('expected success');
    }

    expect(connected.value.accounts[0]).not.toHaveProperty('keyTail');
  });
});
