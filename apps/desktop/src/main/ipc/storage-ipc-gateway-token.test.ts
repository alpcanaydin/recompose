import { defaultSettings } from '@recompose/contracts';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { SecretCodec } from '../storage/safe-storage-codec';
import type { StorageIpcContext } from './storage-context';

import { GATEWAY_TOKEN_REF, maskGatewayToken } from '../settings/gateway-token';
import { getSecret, loadVaultFile } from '../storage/vault';
import { createStorageIpcHandlers } from './storage-ipc';

const fakeCodec: SecretCodec = {
  encrypt: (plain) => Buffer.from(plain, 'utf8').toString('base64'),
  decrypt: (encrypted) => Buffer.from(encrypted, 'base64').toString('utf8'),
  isPlaintextFallback: false,
};

async function freshContext(
  overrides: Partial<StorageIpcContext> = {},
): Promise<StorageIpcContext> {
  const userDataPath = await mkdtemp(join(tmpdir(), 'recompose-token-'));

  return {
    userDataPath,
    getCodec: () => fakeCodec,
    isEncryptionAvailable: () => true,
    onCorrupt: () => undefined,
    writeClipboard: () => undefined,
    applySettings: () => undefined,
    readLoginItem: () => false,
    ...overrides,
  };
}

async function storedToken(ctx: StorageIpcContext): Promise<string | undefined> {
  const vault = await loadVaultFile(join(ctx.userDataPath, 'vault.bin'), () => undefined);

  return getSecret(vault, fakeCodec, GATEWAY_TOKEN_REF);
}

describe('the gateway token: minting', () => {
  test('minting stores the token in the vault and answers with the mask alone', async () => {
    const ctx = await freshContext();
    const handlers = createStorageIpcHandlers(ctx);

    const minted = await handlers['gateway-token:mint'](undefined);
    const token = await storedToken(ctx);

    expect(token).toMatch(/^rc-local-/);
    expect(minted).toEqual({
      ok: true,
      value: { masked: maskGatewayToken(token ?? ''), storage: 'available' },
    });
    expect(JSON.stringify(minted)).not.toContain(token);
  });

  test('regenerating replaces the stored token and reports the new mask', async () => {
    const ctx = await freshContext();
    const handlers = createStorageIpcHandlers(ctx);

    await handlers['gateway-token:mint'](undefined);

    const first = await storedToken(ctx);
    const regenerated = await handlers['gateway-token:mint'](undefined);
    const second = await storedToken(ctx);

    expect(second).not.toBe(first);
    expect(regenerated).toMatchObject({ value: { masked: maskGatewayToken(second ?? '') } });
  });

  test('minting without OS encryption is a typed vault-unavailable that stores nothing', async () => {
    const ctx = await freshContext({ isEncryptionAvailable: () => false });
    const handlers = createStorageIpcHandlers(ctx);

    const minted = await handlers['gateway-token:mint'](undefined);

    expect(minted).toMatchObject({ ok: false, error: { code: 'vault-unavailable' } });
    expect(await storedToken(ctx)).toBeUndefined();
  });

  test('minting against a newer vault schema surfaces as vault-newer-schema', async () => {
    const ctx = await freshContext();

    await writeFile(
      join(ctx.userDataPath, 'vault.bin'),
      JSON.stringify({ schemaVersion: 2, entries: {} }),
      'utf8',
    );

    const minted = await createStorageIpcHandlers(ctx)['gateway-token:mint'](undefined);

    expect(minted).toMatchObject({ ok: false, error: { code: 'vault-newer-schema' } });
  });
});

describe('the gateway token: its status', () => {
  test('an empty vault reports no token beside a working credential store', async () => {
    const handlers = createStorageIpcHandlers(await freshContext());

    const status = await handlers['gateway-token:status'](undefined);

    expect(status).toEqual({ ok: true, value: { masked: null, storage: 'available' } });
  });

  test('the status reads back the mask that minting reported', async () => {
    const handlers = createStorageIpcHandlers(await freshContext());

    const minted = await handlers['gateway-token:mint'](undefined);
    const status = await handlers['gateway-token:status'](undefined);

    expect(status).toEqual(minted);
  });

  test('a plaintext credential store names itself in the status', async () => {
    const handlers = createStorageIpcHandlers(
      await freshContext({ getCodec: () => ({ ...fakeCodec, isPlaintextFallback: true }) }),
    );

    await handlers['gateway-token:mint'](undefined);

    expect(await handlers['gateway-token:status'](undefined)).toMatchObject({
      value: { storage: 'plaintext-fallback' },
    });
  });

  test('without OS encryption the status reports the store as unavailable', async () => {
    const handlers = createStorageIpcHandlers(
      await freshContext({ isEncryptionAvailable: () => false }),
    );

    const status = await handlers['gateway-token:status'](undefined);

    expect(status).toEqual({ ok: true, value: { masked: null, storage: 'unavailable' } });
  });
});

describe('the gateway token: copying', () => {
  test('copying puts the whole token on the clipboard and nothing in the answer', async () => {
    const clipboard: string[] = [];
    const ctx = await freshContext({
      writeClipboard: (text) => {
        clipboard.push(text);
      },
    });
    const handlers = createStorageIpcHandlers(ctx);

    await handlers['gateway-token:mint'](undefined);

    const copied = await handlers['gateway-token:copy'](undefined);

    expect(copied).toEqual({ ok: true, value: undefined });
    expect(clipboard).toEqual([await storedToken(ctx)]);
  });

  test('copying with no stored token is a typed token-missing, not a throw', async () => {
    const clipboard: string[] = [];
    const handlers = createStorageIpcHandlers(
      await freshContext({
        writeClipboard: (text) => {
          clipboard.push(text);
        },
      }),
    );

    const copied = await handlers['gateway-token:copy'](undefined);

    expect(copied).toMatchObject({ ok: false, error: { code: 'token-missing' } });
    expect(clipboard).toEqual([]);
  });
});

describe('the gateway token: the requirement switch', () => {
  test('turning the token requirement off leaves the stored token intact', async () => {
    const ctx = await freshContext();
    const handlers = createStorageIpcHandlers(ctx);

    const minted = await handlers['gateway-token:mint'](undefined);

    await handlers['settings:save']({ ...defaultSettings(), requireGatewayToken: true });
    await handlers['settings:save']({ ...defaultSettings(), requireGatewayToken: false });

    expect(await handlers['gateway-token:status'](undefined)).toEqual(minted);
    expect(await storedToken(ctx)).toMatch(/^rc-local-/);
  });
});

describe('a credential store that stops answering after a token exists', () => {
  const refusingCodec: SecretCodec = {
    encrypt: (plain) => Buffer.from(plain, 'utf8').toString('base64'),
    decrypt: () => {
      throw new Error('the vault could not be decrypted');
    },
    isPlaintextFallback: false,
  };

  test('a status read that fails answers the failure rather than a mask', async () => {
    const ctx = await freshContext();
    const handlers = createStorageIpcHandlers(ctx);

    await handlers['gateway-token:mint']();

    const refusing = createStorageIpcHandlers({ ...ctx, getCodec: () => refusingCodec });
    const status = await refusing['gateway-token:status']();

    expect(status.ok).toBe(false);
  });

  test('a copy whose read fails never reaches the clipboard', async () => {
    const written: string[] = [];
    const ctx = await freshContext({
      writeClipboard: (text) => {
        written.push(text);
      },
    });
    const handlers = createStorageIpcHandlers(ctx);

    await handlers['gateway-token:mint']();

    const refusing = createStorageIpcHandlers({ ...ctx, getCodec: () => refusingCodec });
    const copied = await refusing['gateway-token:copy']();

    expect(copied.ok).toBe(false);
    expect(written).toEqual([]);
  });
});
