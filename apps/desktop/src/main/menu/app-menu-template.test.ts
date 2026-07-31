import { describe, expect, test } from 'vitest';

import type { AppMenuItem } from './app-menu-template';

import { buildAppMenuTemplate } from './app-menu-template';

function everyItem(template: AppMenuItem[]): AppMenuItem[] {
  return template.flatMap((item) => [item, ...everyItem(item.submenu ?? [])]);
}

function itemLabelled(template: AppMenuItem[], label: string): AppMenuItem | undefined {
  return everyItem(template).find((item) => item.label === label);
}

describe('the settings shortcut on the application menu', () => {
  test('macOS carries it in the application menu, where its readers look for it', () => {
    const [applicationMenu] = buildAppMenuTemplate('darwin', () => undefined);

    expect(itemLabelled(applicationMenu?.submenu ?? [], 'Settings…')?.accelerator).toBe(
      'CmdOrCtrl+,',
    );
  });

  test('Windows and Linux carry it in the File menu, where their readers look for it', () => {
    const [fileMenu] = buildAppMenuTemplate('win32', () => undefined);

    expect(fileMenu?.label).toBe('File');
    expect(itemLabelled(fileMenu?.submenu ?? [], 'Settings…')?.accelerator).toBe('CmdOrCtrl+,');
  });

  test('choosing it reaches the settings surface', () => {
    const taken: string[] = [];
    const template = buildAppMenuTemplate('linux', () => {
      taken.push('open-settings');
    });

    itemLabelled(template, 'Settings…')?.click?.();

    expect(taken).toEqual(['open-settings']);
  });
});

function shapeOf(items: AppMenuItem[]): (string | undefined)[] {
  return items.map((item) => item.role ?? item.type ?? item.label);
}

describe('what a custom application menu must not drop', () => {
  test('every platform keeps editing, viewing, and windowing beside its own first menu', () => {
    const platforms: NodeJS.Platform[] = ['darwin', 'win32', 'linux'];

    for (const platform of platforms) {
      const [, ...rest] = buildAppMenuTemplate(platform, () => undefined);

      expect(shapeOf(rest)).toEqual(['editMenu', 'viewMenu', 'windowMenu']);
    }
  });

  test('macOS keeps the whole application menu around the settings item', () => {
    const [applicationMenu] = buildAppMenuTemplate('darwin', () => undefined);

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

  test('Windows and Linux keep the settings item and the way out under File', () => {
    const [fileMenu] = buildAppMenuTemplate('linux', () => undefined);

    expect(shapeOf(fileMenu?.submenu ?? [])).toEqual(['Settings…', 'separator', 'quit']);
  });
});
