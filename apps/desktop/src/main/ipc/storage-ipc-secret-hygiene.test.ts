import { fc, test } from '@fast-check/vitest';
import { ACCOUNTS_VERSION, defaultSettings, type KeyCheckReport } from '@recompose/contracts';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, vi } from 'vitest';

import type { SecretCodec } from '../storage/safe-storage-codec';
import type { AllowedOrigins, TrustedSender } from './sender-trust';
import type { StorageIpcContext } from './storage-context';
import type { StorageIpcHandlers } from './storage-ipc';

import { dispatchIpc } from './dispatch';
import { handlersWith } from './ipc-handlers.testkit';
import { checkHandlersOver, connectedKeyId } from './key-check-ipc.testkit';
import { carriesAnyWindowOf } from './secret-windows.testkit';
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
    applySettings: () => undefined,
    readLoginItem: () => false,
    startGateway: () => undefined,
    restartGateway: () => undefined,
    releaseSubscription: async () => Promise.resolve({ ok: true }),
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
  frameUrl: 'app://renderer/index.html',
  isMainFrame: true,
};
const allowedOrigins: AllowedOrigins = { devServerOrigin: undefined };

describe('storage ipc handlers: a subscription never reaches the vault', () => {
  test('removing a subscription row leaves the vault unopened, because it holds no secret', async () => {
    const ctx = await freshContext();
    const stored = { id: 'sub-1', provider: 'anthropic', kind: 'subscription', label: 'Max' };

    await mkdir(join(ctx.userDataPath, 'vault.bin'));
    await writeFile(
      join(ctx.userDataPath, 'accounts.json'),
      JSON.stringify({ schemaVersion: 2, accounts: [stored] }),
      'utf8',
    );

    const removed = await createStorageIpcHandlers(ctx)['accounts:remove']({ id: 'sub-1' });

    expect(removed).toEqual({ ok: true, value: { schemaVersion: ACCOUNTS_VERSION, accounts: [] } });
  });
});

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
      handlersWith(handlers),
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

async function readSettingsDocument(userDataPath: string): Promise<string> {
  return readFile(join(userDataPath, 'settings.json'), 'utf8').catch(() => '');
}

describe('storage ipc handlers: the settings document holds no secret', () => {
  test.prop([fc.array(fc.constantFrom('dark', 'light', 'system'), { minLength: 1, maxLength: 8 })])(
    'no sequence of saves beside a connected account writes a secret fragment to disk',
    async (themes) => {
      const ctx = await freshContext();
      const handlers = createStorageIpcHandlers(ctx);

      await handlers['accounts:connect'](connectRequest);

      for (const theme of themes) {
        await handlers['settings:save']({ ...defaultSettings(), theme });
      }

      const document = await readSettingsDocument(ctx.userDataPath);

      expect(document).not.toContain(secretFragment);
      expect(carriesAnyWindowOf(document, secretFragment)).toBe(false);
    },
  );
});

function checkKeyOver(ctx: StorageIpcContext, answerProbe: () => KeyCheckReport | null) {
  return checkHandlersOver(ctx.userDataPath, fakeCodec, answerProbe).handlers;
}

async function connectKey(handlers: StorageIpcHandlers, secret: string): Promise<string> {
  return connectedKeyId(await handlers['accounts:connect']({ ...connectRequest, secret }));
}

function silencedConsole() {
  return (['log', 'warn', 'error'] as const).map((level) =>
    vi.spyOn(console, level).mockImplementation(() => undefined),
  );
}

function spokenBy(spies: ReturnType<typeof silencedConsole>): string {
  return spies.map((spy) => spy.mock.calls.map(String).join(' ')).join(' ');
}

const anyVerdict = fc.constantFrom<KeyCheckReport>(
  { verdict: 'authenticates', status: 200 },
  { verdict: 'not-accepted', status: 401 },
  { verdict: 'could-not-check' },
);
const anyKey = fc.string({
  unit: fc.constantFrom('q', 'z', 'x', 'w', '4'),
  minLength: 12,
  maxLength: 48,
});

describe('key check handlers: no answer carries the key', () => {
  test('a connect response carries no window of the key beyond the four-character tail', async () => {
    const handlers = createStorageIpcHandlers(await freshContext());

    const connected = await handlers['accounts:connect'](connectRequest);

    expect(connected).toMatchObject({ ok: true });
    expect(carriesAnyWindowOf(JSON.stringify(connected), secretFragment)).toBe(false);
  });

  test.prop([anyKey, anyVerdict])(
    'a check response never carries any window of the stored key, whatever the verdict',
    async (key, verdict) => {
      const ctx = await freshContext();
      const id = await connectKey(createStorageIpcHandlers(ctx), key);

      const answered = await checkKeyOver(ctx, () => verdict)['accounts:check-key']({ id });

      expect(carriesAnyWindowOf(JSON.stringify(answered), key)).toBe(false);
    },
  );

  test('a check writes no console line carrying any window of the key', async () => {
    const spies = silencedConsole();

    try {
      const ctx = await freshContext();
      const id = await connectKey(createStorageIpcHandlers(ctx), secretFragment);

      await checkKeyOver(ctx, () => ({ verdict: 'not-accepted', status: 401 }))[
        'accounts:check-key'
      ]({ id });

      expect(carriesAnyWindowOf(spokenBy(spies), secretFragment)).toBe(false);
    } finally {
      for (const spy of spies) {
        spy.mockRestore();
      }
    }
  });
});

const storedKeyRow = {
  id: 'acc-one',
  provider: 'anthropic',
  kind: 'api-key',
  label: 'Work key',
  credentialRef: 'cred-one',
  keyTail: '7f2c',
};

describe('storage ipc handlers: listing reads the registry alone', () => {
  test('accounts:list answers rows while the vault is unreadable, because it never opens it', async () => {
    const ctx = await freshContext();
    const registry = JSON.stringify({ schemaVersion: 3, accounts: [storedKeyRow] });

    await writeFile(join(ctx.userDataPath, 'accounts.json'), registry, 'utf8');
    await mkdir(join(ctx.userDataPath, 'vault.bin'));

    const listed = await createStorageIpcHandlers(ctx)['accounts:list'](undefined);

    expect(listed).toMatchObject({ ok: true, value: { accounts: [{ keyTail: '7f2c' }] } });
  });
});
