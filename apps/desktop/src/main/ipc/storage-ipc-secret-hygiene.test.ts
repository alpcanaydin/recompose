import { fc, test } from '@fast-check/vitest';
import { defaultSettings } from '@recompose/contracts';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, vi } from 'vitest';

import type { SecretCodec } from '../storage/safe-storage-codec';
import type { IpcHandlers } from './dispatch';
import type { AllowedOrigins, TrustedSender } from './sender-trust';
import type { StorageIpcContext } from './storage-context';
import type { StorageIpcHandlers } from './storage-ipc';

import { GATEWAY_TOKEN_REF } from '../settings/gateway-token';
import { getSecret, loadVaultFile } from '../storage/vault';
import { dispatchIpc } from './dispatch';
import { createStorageIpcHandlers } from './storage-ipc';

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
    homeFolder: '/Users/ada',
    getCodec: () => fakeCodec,
    isEncryptionAvailable: () => true,
    onCorrupt: () => undefined,
    writeClipboard: () => undefined,
    applySettings: () => undefined,
    readLoginItem: () => false,
    ...overrides,
  };
}

function handlersForDispatch(storage: StorageIpcHandlers): IpcHandlers {
  const absent = async (): Promise<never> => Promise.reject(new Error('not under test'));

  return {
    ...storage,
    'system:get': absent,
    'system:open-config-folder': absent,
    'gateways:offer-port': absent,
    'gateways:move-port': absent,
    'engine:start': absent,
    'engine:stop': absent,
    'engine:states': absent,
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
  frameUrl: 'app://renderer/index.html',
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
      handlersForDispatch(handlers),
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

    try {
      const handlers = createStorageIpcHandlers(await freshContext());
      const noEncryptionHandlers = createStorageIpcHandlers(
        await freshContext({ isEncryptionAvailable: () => false }),
      );

      await handlers['accounts:connect'](connectRequest);
      await noEncryptionHandlers['accounts:connect'](connectRequest);

      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});

const tokenAct = fc.constantFrom('require-on', 'require-off', 'regenerate');

async function readSettingsDocument(userDataPath: string): Promise<string> {
  return readFile(join(userDataPath, 'settings.json'), 'utf8').catch(() => '');
}

async function readStoredToken(userDataPath: string): Promise<string> {
  const vault = await loadVaultFile(join(userDataPath, 'vault.bin'), () => undefined);

  return getSecret(vault, fakeCodec, GATEWAY_TOKEN_REF) ?? '';
}

function windowsOf(value: string, size: number): string[] {
  return Array.from({ length: Math.max(value.length - size + 1, 0) }, (_, start) =>
    value.slice(start, start + size),
  );
}

describe('storage ipc handlers: the settings document and the token', () => {
  test.prop([fc.array(tokenAct, { minLength: 1, maxLength: 8 })])(
    'no sequence of requirement toggles and regenerations writes a token fragment to disk',
    async (acts) => {
      const ctx = await freshContext();
      const handlers = createStorageIpcHandlers(ctx);

      for (const act of acts) {
        if (act === 'regenerate') {
          await handlers['gateway-token:mint'](undefined);
        } else {
          await handlers['settings:save']({
            ...defaultSettings(),
            requireGatewayToken: act === 'require-on',
          });
        }
      }

      const document = await readSettingsDocument(ctx.userDataPath);
      const token = await readStoredToken(ctx.userDataPath);

      expect(document).not.toContain('rc-local-');
      expect(windowsOf(token, 8).some((window) => document.includes(window))).toBe(false);
    },
  );
});
