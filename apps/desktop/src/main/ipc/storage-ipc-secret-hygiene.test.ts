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
import type { SubscriptionsIpcContext } from './subscriptions-ipc';

import { subscriptionHomes } from '../subscriptions/subscription-homes';
import { dispatchIpc } from './dispatch';
import { createStorageIpcHandlers } from './storage-ipc';
import { createSubscriptionsIpcHandlers } from './subscriptions-ipc';

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
    checkKey: async () => Promise.resolve({ verdict: 'could-not-check' as const }),
    releaseSubscription: async () => Promise.resolve({ ok: true }),
    ...overrides,
  };
}

function handlersForDispatch(storage: StorageIpcHandlers): IpcHandlers {
  const absent = async (): Promise<never> => Promise.reject(new Error('not under test'));

  return {
    ...storage,
    'system:get': absent,
    'system:open-config-folder': absent,
    'system:window-band': absent,
    'gateways:offer-port': absent,
    'gateways:move-port': absent,
    'engine:start': absent,
    'engine:stop': absent,
    'engine:states': absent,
    'subscriptions:list': absent,
    'subscriptions:tools': absent,
    'subscriptions:sign-in': absent,
    'subscriptions:restore': absent,
    'subscriptions:activate': absent,
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

    expect(removed).toEqual({ ok: true, value: { schemaVersion: 3, accounts: [] } });
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

async function readSettingsDocument(userDataPath: string): Promise<string> {
  return readFile(join(userDataPath, 'settings.json'), 'utf8').catch(() => '');
}

function windowsOf(value: string, size: number): string[] {
  return Array.from({ length: Math.max(value.length - size + 1, 0) }, (_, start) =>
    value.slice(start, start + size),
  );
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
      expect(windowsOf(secretFragment, 8).some((window) => document.includes(window))).toBe(false);
    },
  );
});

const tokenMaterial = 'sk-ant-oat01-verysecret-subscription-token';

async function aSignedInSubscription(): Promise<SubscriptionsIpcContext> {
  const userDataPath = await mkdtemp(join(tmpdir(), 'recompose-subs-hygiene-'));
  const homes = subscriptionHomes(userDataPath, process.platform);
  const pending = await homes.resetPending('anthropic');

  await writeFile(
    join(pending, '.credentials.json'),
    JSON.stringify({
      claudeAiOauth: {
        accessToken: tokenMaterial,
        refreshToken: `${tokenMaterial}-again`,
        subscriptionType: 'max',
      },
    }),
    'utf8',
  );
  await writeFile(
    join(pending, '.claude.json'),
    JSON.stringify({ oauthAccount: { emailAddress: 'ada@example.com' } }),
    'utf8',
  );
  await homes.promotePending('anthropic', 'acc-one');
  await homes.pointActiveAt('anthropic', 'acc-one');
  await writeFile(
    join(userDataPath, 'accounts.json'),
    JSON.stringify({
      schemaVersion: 2,
      accounts: [
        { id: 'acc-one', provider: 'anthropic', kind: 'subscription', label: 'Claude Code' },
      ],
    }),
    'utf8',
  );

  return {
    userDataPath,
    homeFolder: '/Users/ada',
    platform: process.platform,
    custody: null,
    searchPath: async () => Promise.resolve(''),
    launch: async () => Promise.resolve(),
    clock: () => ({ elapsed: () => 0, sleep: async () => Promise.resolve() }),
    signInBoundMs: 0,
    signInEveryMs: 0,
    onCorrupt: () => undefined,
  };
}

function carriesNoTokenMaterial(answer: unknown): boolean {
  const spoken = JSON.stringify(answer);

  return !windowsOf(tokenMaterial, 8).some((window) => spoken.includes(window));
}

describe('subscription ipc handlers: no answer carries token material', () => {
  test('listing a signed-in subscription names its plan and its address, and no token', async () => {
    const handlers = createSubscriptionsIpcHandlers(await aSignedInSubscription());

    const answered = await handlers['subscriptions:list']();

    expect(answered).toMatchObject({
      ok: true,
      value: [{ standing: 'connected', plan: 'max', signedInAs: 'ada@example.com' }],
    });
    expect(carriesNoTokenMaterial(answered)).toBe(true);
  });

  test('activating a signed-in subscription answers without a token', async () => {
    const handlers = createSubscriptionsIpcHandlers(await aSignedInSubscription());

    const answered = await handlers['subscriptions:activate']({ id: 'acc-one' });

    expect(answered).toMatchObject({ ok: true, value: [{ active: true }] });
    expect(carriesNoTokenMaterial(answered)).toBe(true);
  });

  test('a refused restore names the tool rather than anything the tool holds', async () => {
    const handlers = createSubscriptionsIpcHandlers(await aSignedInSubscription());

    const answered = await handlers['subscriptions:restore']({ id: 'acc-one' });

    expect(answered).toMatchObject({ ok: false, error: { code: 'tool-missing' } });
    expect(carriesNoTokenMaterial(answered)).toBe(true);
  });
});
