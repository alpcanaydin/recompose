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

describe('what a custom application menu must not drop', () => {
  test('macOS keeps editing, so copy and paste survive replacing the default menu', () => {
    const roles = everyItem(buildAppMenuTemplate('darwin', () => undefined)).map(
      (item) => item.role,
    );

    expect(roles).toContain('editMenu');
  });

  test('Windows and Linux keep editing for the same reason', () => {
    const roles = everyItem(buildAppMenuTemplate('win32', () => undefined)).map(
      (item) => item.role,
    );

    expect(roles).toContain('editMenu');
  });

  test('every platform keeps a way to quit', () => {
    const platforms: NodeJS.Platform[] = ['darwin', 'win32', 'linux'];

    for (const platform of platforms) {
      const roles = everyItem(buildAppMenuTemplate(platform, () => undefined)).map(
        (item) => item.role,
      );

      expect(roles).toContain('quit');
    }
  });
});
