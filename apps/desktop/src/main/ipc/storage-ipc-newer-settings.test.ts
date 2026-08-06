import { defaultSettings, SETTINGS_VERSION } from '@recompose/contracts';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { StorageIpcContext } from './storage-context';

import { createStorageIpcHandlers } from './storage-ipc';

const fromTheFuture = JSON.stringify({
  schemaVersion: SETTINGS_VERSION + 1,
  theme: 'dark',
  enginePort: 9100,
  aFieldThisBuildNeverHeardOf: true,
});

async function contextHoldingAFutureDocument(): Promise<StorageIpcContext> {
  const userDataPath = await mkdtemp(join(tmpdir(), 'recompose-future-'));

  await writeFile(join(userDataPath, 'settings.json'), fromTheFuture, 'utf8');

  return {
    userDataPath,
    homeFolder: '/Users/ada',
    getCodec: () => ({ encrypt: (p) => p, decrypt: (p) => p, isPlaintextFallback: false }),
    isEncryptionAvailable: () => true,
    onCorrupt: () => undefined,
    readLoginItem: () => false,
    startGateway: () => undefined,
    restartGateway: () => undefined,
    applySettings: () => undefined,
    releaseSubscription: async () => Promise.resolve({ ok: true }),
  };
}

describe('an older build meeting a settings document from a newer one', () => {
  test('reading names the newer schema rather than a storage failure', async () => {
    const handlers = createStorageIpcHandlers(await contextHoldingAFutureDocument());

    expect(await handlers['settings:get'](undefined)).toMatchObject({
      ok: false,
      error: { code: 'settings-newer-schema' },
    });
  });

  test('saving refuses rather than writing this build shape over the newer one', async () => {
    const ctx = await contextHoldingAFutureDocument();
    const handlers = createStorageIpcHandlers(ctx);

    const answered = await handlers['settings:save']({ theme: 'light' });

    expect(answered).toMatchObject({ ok: false, error: { code: 'settings-newer-schema' } });
    expect(await readFile(join(ctx.userDataPath, 'settings.json'), 'utf8')).toBe(fromTheFuture);
  });

  test('a document this build understands still reads and saves', async () => {
    const ctx = await contextHoldingAFutureDocument();

    await writeFile(join(ctx.userDataPath, 'settings.json'), JSON.stringify(defaultSettings()));

    const handlers = createStorageIpcHandlers(ctx);

    expect(await handlers['settings:save']({ theme: 'light' })).toMatchObject({
      ok: true,
      value: { theme: 'light' },
    });
  });
});
