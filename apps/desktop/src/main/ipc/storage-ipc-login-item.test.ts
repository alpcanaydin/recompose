import { defaultSettings } from '@recompose/contracts';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { StorageIpcContext } from './storage-context';

import { applyChosenSettings } from '../settings/apply-settings';
import { createStorageIpcHandlers } from './storage-ipc';

async function osBackedContext(osHolds: boolean) {
  const writes: boolean[] = [];
  let operatingSystem = osHolds;
  const ctx: StorageIpcContext = {
    userDataPath: await mkdtemp(join(tmpdir(), 'recompose-login-')),
    homeFolder: '/Users/ada',
    getCodec: () => ({
      encrypt: (plain) => plain,
      decrypt: (blob) => blob,
      isPlaintextFallback: false,
    }),
    isEncryptionAvailable: () => true,
    onCorrupt: () => undefined,
    writeClipboard: () => undefined,
    startGateway: () => undefined,
    readLoginItem: () => operatingSystem,
    applySettings: (settings, askedLoginItem) => {
      applyChosenSettings(
        {
          setThemeSource: () => undefined,
          setMenuBarVisible: () => undefined,
          setLoginItem: (enabled) => {
            writes.push(enabled);
            operatingSystem = enabled;
          },
        },
        settings,
        askedLoginItem,
      );
    },
  };

  return { ctx, writes, operatingSystem: () => operatingSystem };
}

describe('the launch at login switch and the operating system that owns the flag', () => {
  test('a save that names the switch writes what it asks for', async () => {
    const { ctx, writes, operatingSystem } = await osBackedContext(false);

    await createStorageIpcHandlers(ctx)['settings:save']({ launchAtLogin: true });

    expect(writes).toEqual([true]);
    expect(operatingSystem()).toBe(true);
  });

  test('a person who removed the login item outside the app can put it back', async () => {
    const { ctx, writes, operatingSystem } = await osBackedContext(false);
    const handlers = createStorageIpcHandlers(ctx);

    await handlers['settings:save']({ launchAtLogin: true });

    const removedOutside = await osBackedContext(false);
    const afterRemoval = createStorageIpcHandlers({
      ...removedOutside.ctx,
      userDataPath: ctx.userDataPath,
    });

    expect(await afterRemoval['settings:get'](undefined)).toMatchObject({
      value: { launchAtLogin: false },
    });

    await afterRemoval['settings:save']({ launchAtLogin: true });

    expect(removedOutside.writes).toEqual([true]);
    expect(removedOutside.operatingSystem()).toBe(true);
    expect(writes).toEqual([true]);
    expect(operatingSystem()).toBe(true);
  });

  test('a save that never names the switch leaves a removal made outside the app standing', async () => {
    const { ctx, writes } = await osBackedContext(false);
    const handlers = createStorageIpcHandlers(ctx);

    await handlers['settings:save']({ launchAtLogin: true });

    const removedOutside = await osBackedContext(false);
    const afterRemoval = createStorageIpcHandlers({
      ...removedOutside.ctx,
      userDataPath: ctx.userDataPath,
    });

    await afterRemoval['settings:save']({ theme: 'dark' });

    expect(removedOutside.writes).toEqual([]);
    expect(removedOutside.operatingSystem()).toBe(false);
    expect(writes).toEqual([true]);
  });
});

describe('a save that names only part of the document', () => {
  test('every field it leaves out keeps what the document already held', async () => {
    const { ctx } = await osBackedContext(false);
    const handlers = createStorageIpcHandlers(ctx);

    await handlers['settings:save']({ launchAtLogin: true, theme: 'dark' });
    await handlers['settings:save']({ showInMenuBar: true });

    expect(await handlers['settings:get'](undefined)).toMatchObject({
      value: { launchAtLogin: true, theme: 'dark', showInMenuBar: true },
    });
  });

  test('a save that names nothing changes nothing at all', async () => {
    const { ctx, writes } = await osBackedContext(false);
    const handlers = createStorageIpcHandlers(ctx);

    const answered = await handlers['settings:save']({});

    expect(writes).toEqual([]);
    expect(answered).toMatchObject({ value: defaultSettings() });
  });
});
