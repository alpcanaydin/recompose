import { describe, expect, test } from 'vitest';

import type { SystemIpcContext } from './system-ipc';

import { createSystemIpcHandlers } from './system-ipc';

const configFolder = '/home/someone/.config/recompose';

function systemContext(overrides: Partial<SystemIpcContext> = {}): SystemIpcContext {
  return {
    fileBrowser: 'finder',
    loginItem: 'available',
    configFolder,
    homeFolder: '/home/someone',
    readLoginItem: () => false,
    isMenuBarVisible: () => false,
    openFolder: async () => Promise.resolve(''),
    placeWindowButtons: () => undefined,
    answerTitleBarDoubleClick: () => undefined,
    ...overrides,
  };
}

describe('the system state behind the settings screen', () => {
  test('carries the file browser, the login item, the menu bar, and the config folder', async () => {
    const handlers = createSystemIpcHandlers(
      systemContext({
        fileBrowser: 'explorer',
        loginItem: 'unpackaged',
        readLoginItem: () => true,
        isMenuBarVisible: () => true,
      }),
    );

    expect(await handlers['system:get'](undefined)).toEqual({
      ok: true,
      value: {
        fileBrowser: 'explorer',
        loginItem: 'unpackaged',
        loginItemEnabled: true,
        menuBarVisible: true,
        configFolder: '~/.config/recompose',
      },
    });
  });

  test('reports the operating system login item as it stands on each fetch', async () => {
    let enabledInOperatingSystem = false;
    const handlers = createSystemIpcHandlers(
      systemContext({ readLoginItem: () => enabledInOperatingSystem }),
    );

    const before = await handlers['system:get'](undefined);

    enabledInOperatingSystem = true;

    const after = await handlers['system:get'](undefined);

    expect(before).toMatchObject({ ok: true, value: { loginItemEnabled: false } });
    expect(after).toMatchObject({ ok: true, value: { loginItemEnabled: true } });
  });

  test('reports the menu bar as it stands on each fetch', async () => {
    let trayShowing = false;
    const handlers = createSystemIpcHandlers(
      systemContext({ isMenuBarVisible: () => trayShowing }),
    );

    const before = await handlers['system:get'](undefined);

    trayShowing = true;

    const after = await handlers['system:get'](undefined);

    expect(before).toMatchObject({ ok: true, value: { menuBarVisible: false } });
    expect(after).toMatchObject({ ok: true, value: { menuBarVisible: true } });
  });
});

describe('a double-click on the title bar', () => {
  test('is carried through to the window action the renderer cannot reach', async () => {
    let answered = 0;
    const handlers = createSystemIpcHandlers(
      systemContext({
        answerTitleBarDoubleClick: () => {
          answered += 1;
        },
      }),
    );

    const result = await handlers['system:title-bar-double-click'](undefined);

    expect(answered).toBe(1);
    expect(result).toEqual({ ok: true, value: undefined });
  });
});

describe('opening the config folder', () => {
  test('hands the file browser the folder the state names', async () => {
    const opened: string[] = [];
    const handlers = createSystemIpcHandlers(
      systemContext({
        openFolder: async (path) => {
          opened.push(path);

          return Promise.resolve('');
        },
      }),
    );

    const result = await handlers['system:open-config-folder'](undefined);

    expect(opened).toEqual([configFolder]);
    expect(result).toEqual({ ok: true, value: undefined });
  });

  test('a refusal from the operating system arrives as a typed failure carrying its reason', async () => {
    const handlers = createSystemIpcHandlers(
      systemContext({ openFolder: async () => Promise.resolve('Failed to open path') }),
    );

    expect(await handlers['system:open-config-folder'](undefined)).toEqual({
      ok: false,
      error: {
        code: 'folder-open-failed',
        message: 'could not open the config folder: Failed to open path',
      },
    });
  });
});
