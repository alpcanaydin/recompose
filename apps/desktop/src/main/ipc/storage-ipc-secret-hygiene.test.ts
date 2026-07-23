import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import type { SecretCodec } from '../storage/safe-storage-codec';
import type { AllowedOrigins, TrustedSender } from './sender-trust';

import { dispatchIpc } from './dispatch';
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

const connectRequest = {
  provider: 'anthropic',
  kind: 'api-key' as const,
  label: 'Work key',
  secret: 'sk-verysecret',
};

const secretFragment = 'sk-verysecret';
const trustedSender: TrustedSender = {
  frameUrl: 'file:///Applications/recompose.app/renderer/index.html',
  isMainFrame: true,
};
const allowedOrigins: AllowedOrigins = { devServerOrigin: undefined };

describe('storage ipc handlers: accounts connect secret hygiene', () => {
  test('vault-unavailable never leaks the secret', async () => {
    const handlers = createStorageIpcHandlers(
      await freshContext({ isEncryptionAvailable: () => false }),
    );

    const result = await handlers['accounts:connect'](connectRequest);

    expect(JSON.stringify(result)).not.toContain(secretFragment);
  });

  test('vault-newer-schema never leaks the secret', async () => {
    const ctx = await freshContext();

    await writeFile(
      join(ctx.userDataPath, 'vault.bin'),
      JSON.stringify({ schemaVersion: 2, entries: {} }),
      'utf8',
    );

    const handlers = createStorageIpcHandlers(ctx);
    const result = await handlers['accounts:connect'](connectRequest);

    expect(JSON.stringify(result)).not.toContain(secretFragment);
  });

  test('storage-failed never leaks the secret', async () => {
    const ctx = await freshContext();

    await mkdir(join(ctx.userDataPath, 'accounts.json'));

    const handlers = createStorageIpcHandlers(ctx);
    const result = await handlers['accounts:connect'](connectRequest);

    expect(result).toMatchObject({ ok: false, error: { code: 'storage-failed' } });
    expect(JSON.stringify(result)).not.toContain(secretFragment);
  });

  test('dispatch-level validation-failed never leaks the secret', async () => {
    const handlers = createStorageIpcHandlers(await freshContext());
    const malformedRequest = { ...connectRequest, kind: 'oauth' };

    const result = await dispatchIpc(
      handlers,
      'accounts:connect',
      malformedRequest,
      trustedSender,
      allowedOrigins,
    );

    expect(result).toMatchObject({ ok: false, error: { code: 'validation-failed' } });
    expect(JSON.stringify(result)).not.toContain(secretFragment);
  });
});

describe('storage ipc handlers: accounts connect logs nothing', () => {
  test('connecting logs nothing to the console, on success or on any failure mode', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const handlers = createStorageIpcHandlers(await freshContext());
    const noEncryptionHandlers = createStorageIpcHandlers(
      await freshContext({ isEncryptionAvailable: () => false }),
    );

    await handlers['accounts:connect'](connectRequest);
    await noEncryptionHandlers['accounts:connect'](connectRequest);

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
