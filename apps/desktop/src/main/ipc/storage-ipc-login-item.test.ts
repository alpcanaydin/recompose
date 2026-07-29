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
    getCodec: () => ({ encrypt: (p) => p, decrypt: (p) => p, isPlaintextFallback: false }),
    isEncryptionAvailable: () => true,
    onCorrupt: () => undefined,
    writeClipboard: () => undefined,
    readLoginItem: () => operatingSystem,
    applySettings: (settings, previous) => {
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
        previous,
      );
    },
  };

  return { ctx, writes, operatingSystem: () => operatingSystem };
}

describe('the launch at login switch, once the operating system disagrees with the stored value', () => {
  test('turning it on reaches the operating system even though the stored value already said on', async () => {
    const { ctx, writes, operatingSystem } = await osBackedContext(false);
    const handlers = createStorageIpcHandlers(ctx);

    await handlers['settings:save']({ ...defaultSettings(), launchAtLogin: true });
    writes.length = 0;

    const asShown = await handlers['settings:get'](undefined);

    expect(asShown).toMatchObject({ value: { launchAtLogin: true } });

    await handlers['settings:save']({ ...defaultSettings(), launchAtLogin: true });

    expect(writes).toEqual([]);
    expect(operatingSystem()).toBe(true);
  });

  test('a person who removed the login item outside the app can put it back', async () => {
    const { ctx, writes, operatingSystem } = await osBackedContext(false);
    const handlers = createStorageIpcHandlers(ctx);

    await handlers['settings:save']({ ...defaultSettings(), launchAtLogin: true });

    const removedOutside = await osBackedContext(false);
    const afterRemoval = createStorageIpcHandlers({
      ...removedOutside.ctx,
      userDataPath: ctx.userDataPath,
    });

    expect(await afterRemoval['settings:get'](undefined)).toMatchObject({
      value: { launchAtLogin: false },
    });

    await afterRemoval['settings:save']({ ...defaultSettings(), launchAtLogin: true });

    expect(removedOutside.writes).toEqual([true]);
    expect(removedOutside.operatingSystem()).toBe(true);
    expect(writes).toEqual([true]);
    expect(operatingSystem()).toBe(true);
  });

  test('a save that changes only the theme leaves the login item where the operating system holds it', async () => {
    const { ctx, writes } = await osBackedContext(false);
    const handlers = createStorageIpcHandlers(ctx);

    await handlers['settings:save']({ ...defaultSettings(), theme: 'dark' });

    expect(writes).toEqual([]);
  });
});
