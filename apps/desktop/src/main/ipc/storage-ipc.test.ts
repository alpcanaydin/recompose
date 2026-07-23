import { GATEWAY_CONFIG_VERSION, type GatewayConfig } from '@recompose/contracts';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { SecretCodec } from '../storage/safe-storage-codec';

import { loadVaultFile } from '../storage/vault';
import { createStorageIpcHandlers, type StorageIpcContext } from './storage-ipc';

const fakeCodec: SecretCodec = {
  encrypt: (plain) => Buffer.from(plain, 'utf8').toString('base64'),
  decrypt: (encrypted) => Buffer.from(encrypted, 'base64').toString('utf8'),
  isPlaintextFallback: false,
};

async function freshContext(
  overrides: Partial<StorageIpcContext> = {},
): Promise<StorageIpcContext> {
  const userDataPath = await mkdtemp(join(tmpdir(), 'recompose-ipc-'));

  return {
    userDataPath,
    getCodec: () => fakeCodec,
    isEncryptionAvailable: () => true,
    onCorrupt: () => undefined,
    ...overrides,
  };
}

const gateway: GatewayConfig = {
  schemaVersion: GATEWAY_CONFIG_VERSION,
  slug: 'personal',
  displayName: 'Personal',
  virtualModels: [
    {
      id: 'vm1',
      slug: 'fast',
      displayName: 'fast',
      routing: {
        kind: 'target',
        id: 't1',
        accountId: 'a1',
        providerModel: 'claude-sonnet-5',
        weight: 100,
      },
    },
  ],
  layout: { nodes: {} },
};

const connectRequest = {
  provider: 'anthropic',
  kind: 'api-key' as const,
  label: 'Work key',
  secret: 'sk-verysecret',
};

describe('storage ipc handlers: gateways', () => {
  test('gateways round-trip: save returns the updated list, list agrees', async () => {
    const handlers = createStorageIpcHandlers(await freshContext());

    const saved = await handlers['gateways:save'](gateway);
    const listed = await handlers['gateways:list'](undefined);

    expect(saved).toEqual({ ok: true, value: [gateway] });
    expect(listed).toEqual({ ok: true, value: [gateway] });
  });
});

describe('storage ipc handlers: settings', () => {
  test('settings default on first read and persist on save', async () => {
    const handlers = createStorageIpcHandlers(await freshContext());

    const first = await handlers['settings:get'](undefined);
    const written = await handlers['settings:save']({
      schemaVersion: 1,
      theme: 'dark',
      enginePort: 9000,
    });
    const second = await handlers['settings:get'](undefined);

    expect(first).toMatchObject({ ok: true, value: { theme: 'system', enginePort: 8397 } });
    expect(written).toEqual(second);
  });
});

describe('storage ipc handlers: accounts connect', () => {
  test('connect stores the account and the encrypted secret, never plaintext on disk', async () => {
    const ctx = await freshContext();
    const handlers = createStorageIpcHandlers(ctx);

    const result = await handlers['accounts:connect'](connectRequest);

    expect(result).toMatchObject({
      ok: true,
      value: { accounts: [{ provider: 'anthropic', kind: 'api-key', label: 'Work key' }] },
    });

    if (!result.ok) {
      throw new Error('expected success');
    }

    const account = result.value.accounts[0];

    expect(account?.credentialRef).toBeDefined();
    expect(JSON.stringify(result.value)).not.toContain('sk-verysecret');

    const vault = await loadVaultFile(join(ctx.userDataPath, 'vault.bin'), () => undefined);

    expect(Object.keys(vault.entries)).toEqual([account?.credentialRef]);
    expect(JSON.stringify(vault)).not.toContain('sk-verysecret');
  });

  test('connect without OS encryption is a typed vault-unavailable, not a throw', async () => {
    const handlers = createStorageIpcHandlers(
      await freshContext({ isEncryptionAvailable: () => false }),
    );

    const result = await handlers['accounts:connect'](connectRequest);

    expect(result).toMatchObject({ ok: false, error: { code: 'vault-unavailable' } });
  });

  test('a newer vault schema surfaces as vault-newer-schema', async () => {
    const ctx = await freshContext();

    await writeFile(
      join(ctx.userDataPath, 'vault.bin'),
      JSON.stringify({ schemaVersion: 2, entries: {} }),
      'utf8',
    );

    const handlers = createStorageIpcHandlers(ctx);

    const result = await handlers['accounts:connect'](connectRequest);

    expect(result).toMatchObject({ ok: false, error: { code: 'vault-newer-schema' } });
  });

  test('an unreadable vault file surfaces as storage-failed, not vault-newer-schema', async () => {
    const ctx = await freshContext();

    await mkdir(join(ctx.userDataPath, 'vault.bin'));

    const handlers = createStorageIpcHandlers(ctx);

    const result = await handlers['accounts:connect'](connectRequest);

    expect(result).toMatchObject({ ok: false, error: { code: 'storage-failed' } });
  });
});

describe('storage ipc handlers: accounts remove', () => {
  test('remove deletes the account row and its vault entry together', async () => {
    const ctx = await freshContext();
    const handlers = createStorageIpcHandlers(ctx);
    const connected = await handlers['accounts:connect'](connectRequest);

    if (!connected.ok) {
      throw new Error('expected success');
    }

    const id = connected.value.accounts[0]?.id ?? '';

    const removed = await handlers['accounts:remove']({ id });

    expect(removed).toEqual({ ok: true, value: { schemaVersion: 1, accounts: [] } });

    const vault = await loadVaultFile(join(ctx.userDataPath, 'vault.bin'), () => undefined);

    expect(vault.entries).toEqual({});
  });

  test('removing an unknown id is idempotent success', async () => {
    const handlers = createStorageIpcHandlers(await freshContext());

    const removed = await handlers['accounts:remove']({ id: 'ghost' });

    expect(removed).toEqual({ ok: true, value: { schemaVersion: 1, accounts: [] } });
  });

  test('removing against a newer-schema vault surfaces as vault-newer-schema', async () => {
    const ctx = await freshContext();
    const handlers = createStorageIpcHandlers(ctx);
    const connected = await handlers['accounts:connect'](connectRequest);

    if (!connected.ok) {
      throw new Error('expected success');
    }

    const id = connected.value.accounts[0]?.id ?? '';

    await writeFile(
      join(ctx.userDataPath, 'vault.bin'),
      JSON.stringify({ schemaVersion: 2, entries: {} }),
      'utf8',
    );

    const removed = await handlers['accounts:remove']({ id });

    expect(removed).toMatchObject({ ok: false, error: { code: 'vault-newer-schema' } });
  });
});

describe('storage ipc handlers: accounts list', () => {
  test('accounts:list agrees with what connect wrote', async () => {
    const handlers = createStorageIpcHandlers(await freshContext());

    const before = await handlers['accounts:list'](undefined);

    await handlers['accounts:connect'](connectRequest);

    const after = await handlers['accounts:list'](undefined);

    expect(before).toEqual({ ok: true, value: { schemaVersion: 1, accounts: [] } });

    if (!after.ok) {
      throw new Error('expected success');
    }

    expect(after.value.accounts).toHaveLength(1);
  });
});

describe('storage ipc handlers: storage failures', () => {
  test('an unwritable path surfaces settings:save as storage-failed, not a throw', async () => {
    const blockingDir = await mkdtemp(join(tmpdir(), 'recompose-ipc-blocked-'));
    const blockingPath = join(blockingDir, 'not-a-directory');

    await writeFile(blockingPath, '', 'utf8');

    const handlers = createStorageIpcHandlers(await freshContext({ userDataPath: blockingPath }));

    const result = await handlers['settings:save']({
      schemaVersion: 1,
      theme: 'dark',
      enginePort: 9000,
    });

    expect(result).toMatchObject({ ok: false, error: { code: 'storage-failed' } });
  });
});
