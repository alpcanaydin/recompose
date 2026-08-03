import { ACCOUNTS_VERSION } from '@recompose/contracts';
import { access, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { StorageIpcContext } from './storage-context';

import { createStorageIpcHandlers } from './storage-ipc';

const fromTheFuture = JSON.stringify({
  schemaVersion: ACCOUNTS_VERSION + 1,
  accounts: [{ id: 'acc-1', provider: 'anthropic', kind: 'subscription', label: 'Max' }],
  aFieldThisBuildNeverHeardOf: true,
});

async function contextHoldingAFutureRegistry(): Promise<StorageIpcContext> {
  const userDataPath = await mkdtemp(join(tmpdir(), 'recompose-future-accounts-'));

  await writeFile(join(userDataPath, 'accounts.json'), fromTheFuture, 'utf8');

  return {
    userDataPath,
    homeFolder: '/Users/ada',
    getCodec: () => ({ encrypt: (p) => p, decrypt: (p) => p, isPlaintextFallback: false }),
    isEncryptionAvailable: () => true,
    onCorrupt: () => undefined,
    readLoginItem: () => false,
    startGateway: () => undefined,
    applySettings: () => undefined,
    releaseSubscription: async () => Promise.resolve({ ok: true }),
  };
}

async function holds(filePath: string): Promise<boolean> {
  return access(filePath).then(
    () => true,
    () => false,
  );
}

describe('an older build meeting an accounts document from a newer one', () => {
  test('listing names the newer schema rather than an empty registry', async () => {
    const handlers = createStorageIpcHandlers(await contextHoldingAFutureRegistry());

    expect(await handlers['accounts:list'](undefined)).toMatchObject({
      ok: false,
      error: { code: 'accounts-newer-schema' },
    });
  });

  test('connecting a key refuses before any secret reaches the vault', async () => {
    const ctx = await contextHoldingAFutureRegistry();
    const handlers = createStorageIpcHandlers(ctx);

    const answered = await handlers['accounts:connect']({
      provider: 'anthropic',
      kind: 'api-key',
      label: 'Work',
      secret: 'sk-ant-api03-0123456789abcdef',
    });

    expect(answered).toMatchObject({ ok: false, error: { code: 'accounts-newer-schema' } });
    expect(await holds(join(ctx.userDataPath, 'vault.bin'))).toBe(false);
    expect(await readFile(join(ctx.userDataPath, 'accounts.json'), 'utf8')).toBe(fromTheFuture);
  });

  test('removing a row refuses rather than writing this build shape over the newer one', async () => {
    const ctx = await contextHoldingAFutureRegistry();
    const handlers = createStorageIpcHandlers(ctx);

    const answered = await handlers['accounts:remove']({ id: 'acc-1' });

    expect(answered).toMatchObject({ ok: false, error: { code: 'accounts-newer-schema' } });
    expect(await readFile(join(ctx.userDataPath, 'accounts.json'), 'utf8')).toBe(fromTheFuture);
  });

  test('the refusal names the version the document carries', async () => {
    const handlers = createStorageIpcHandlers(await contextHoldingAFutureRegistry());
    const listed = await handlers['accounts:list'](undefined);

    if (listed.ok) {
      throw new Error('expected a refusal');
    }

    expect(listed.error.message).toContain(String(ACCOUNTS_VERSION + 1));
  });

  test('a registry this build understands still lists', async () => {
    const ctx = await contextHoldingAFutureRegistry();

    await writeFile(
      join(ctx.userDataPath, 'accounts.json'),
      JSON.stringify({ schemaVersion: ACCOUNTS_VERSION, accounts: [] }),
      'utf8',
    );

    expect(await createStorageIpcHandlers(ctx)['accounts:list'](undefined)).toMatchObject({
      ok: true,
      value: { schemaVersion: ACCOUNTS_VERSION, accounts: [] },
    });
  });
});
