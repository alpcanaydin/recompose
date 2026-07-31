import { describe, expect, test } from 'vitest';

import type { AppMenuHandlers, AppMenuItem } from './app-menu-template';

import { buildAppMenuTemplate } from './app-menu-template';

function everyItem(template: AppMenuItem[]): AppMenuItem[] {
  return template.flatMap((item) => [item, ...everyItem(item.submenu ?? [])]);
}

function itemLabelled(template: AppMenuItem[], label: string): AppMenuItem | undefined {
  return everyItem(template).find((item) => item.label === label);
}

function menuLabelled(template: AppMenuItem[], label: string): AppMenuItem | undefined {
  return template.find((item) => item.label === label);
}

function shapeOf(items: AppMenuItem[]): (string | undefined)[] {
  return items.map((item) => item.role ?? item.type ?? item.label);
}

function recordingHandlers(taken: string[]): AppMenuHandlers {
  return {
    onOpenSettings: () => {
      taken.push('open-settings');
    },
    onNewGateway: () => {
      taken.push('new-gateway');
    },
    onShowGetStarted: () => {
      taken.push('show-get-started');
    },
  };
}

const idleHandlers = recordingHandlers([]);
const everyPlatform: NodeJS.Platform[] = ['darwin', 'win32', 'linux'];

describe('the settings shortcut on the application menu', () => {
  test('macOS carries it in the application menu, where its readers look for it', () => {
    const [applicationMenu] = buildAppMenuTemplate('darwin', idleHandlers);

    expect(itemLabelled(applicationMenu?.submenu ?? [], 'Settings…')?.accelerator).toBe(
      'CmdOrCtrl+,',
    );
  });

  test('Windows and Linux carry it in the File menu, where their readers look for it', () => {
    const fileMenu = menuLabelled(buildAppMenuTemplate('win32', idleHandlers), 'File');

    expect(itemLabelled(fileMenu?.submenu ?? [], 'Settings…')?.accelerator).toBe('CmdOrCtrl+,');
  });

  test('choosing it reaches the settings surface', () => {
    const taken: string[] = [];

    itemLabelled(buildAppMenuTemplate('linux', recordingHandlers(taken)), 'Settings…')?.click?.();

    expect(taken).toEqual(['open-settings']);
  });
});

describe('creating a gateway from the menu bar', () => {
  test('every platform offers it under File, on the shortcut a new document uses', () => {
    for (const platform of everyPlatform) {
      const fileMenu = menuLabelled(buildAppMenuTemplate(platform, idleHandlers), 'File');

      expect(itemLabelled(fileMenu?.submenu ?? [], 'New Gateway…')?.accelerator).toBe(
        'CmdOrCtrl+N',
      );
    }
  });

  test('choosing it opens the creation sheet', () => {
    const taken: string[] = [];

    itemLabelled(
      buildAppMenuTemplate('darwin', recordingHandlers(taken)),
      'New Gateway…',
    )?.click?.();

    expect(taken).toEqual(['new-gateway']);
  });
});

describe('bringing the get-started card back', () => {
  test('every platform offers it under View, where a dismissed panel is found', () => {
    for (const platform of everyPlatform) {
      const viewMenu = menuLabelled(buildAppMenuTemplate(platform, idleHandlers), 'View');

      expect(itemLabelled(viewMenu?.submenu ?? [], 'Show Get Started')).toBeDefined();
    }
  });

  test('choosing it shows the card again', () => {
    const taken: string[] = [];

    itemLabelled(
      buildAppMenuTemplate('linux', recordingHandlers(taken)),
      'Show Get Started',
    )?.click?.();

    expect(taken).toEqual(['show-get-started']);
  });
});

describe('the order the menus stand in', () => {
  test('macOS orders its menus the way every Mac app does', () => {
    expect(shapeOf(buildAppMenuTemplate('darwin', idleHandlers))).toEqual([
      'Recompose',
      'File',
      'editMenu',
      'View',
      'windowMenu',
    ]);
  });

  test('Windows and Linux lead with File and keep the rest beside it', () => {
    for (const platform of ['win32', 'linux'] satisfies NodeJS.Platform[]) {
      expect(shapeOf(buildAppMenuTemplate(platform, idleHandlers))).toEqual([
        'File',
        'editMenu',
        'View',
        'windowMenu',
      ]);
    }
  });
});

describe('what a custom application menu must not drop', () => {
  test('macOS keeps the whole application menu around the settings item', () => {
    const [applicationMenu] = buildAppMenuTemplate('darwin', idleHandlers);

    expect(applicationMenu?.label).toBe('Recompose');
    expect(shapeOf(applicationMenu?.submenu ?? [])).toEqual([
      'about',
      'separator',
      'Settings…',
      'separator',
      'services',
      'separator',
      'hide',
      'hideOthers',
      'unhide',
      'separator',
      'quit',
    ]);
  });

  test('macOS keeps File to the document actions, because quitting lives in its own menu', () => {
    const fileMenu = menuLabelled(buildAppMenuTemplate('darwin', idleHandlers), 'File');

    expect(shapeOf(fileMenu?.submenu ?? [])).toEqual(['New Gateway…', 'separator', 'close']);
  });

  test('Windows and Linux keep the settings item and the way out under File', () => {
    const fileMenu = menuLabelled(buildAppMenuTemplate('linux', idleHandlers), 'File');

    expect(shapeOf(fileMenu?.submenu ?? [])).toEqual([
      'New Gateway…',
      'separator',
      'Settings…',
      'separator',
      'quit',
    ]);
  });

  test('the View menu keeps reloading, zooming, and full screen beside the new item', () => {
    const viewMenu = menuLabelled(buildAppMenuTemplate('darwin', idleHandlers), 'View');

    expect(shapeOf(viewMenu?.submenu ?? [])).toEqual([
      'Show Get Started',
      'separator',
      'reload',
      'forceReload',
      'toggleDevTools',
      'separator',
      'resetZoom',
      'zoomIn',
      'zoomOut',
      'separator',
      'togglefullscreen',
    ]);
  });
});
