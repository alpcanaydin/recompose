import { describe, expect, test } from 'vitest';

import type { TrayMenuHandlers, TrayMenuItem } from './tray-menu-template';

import { buildTrayMenuTemplate } from './tray-menu-template';

function recordingHandlers(taken: string[]): TrayMenuHandlers {
  return {
    onOpenWindow: () => {
      taken.push('open-window');
    },
    onOpenSettings: () => {
      taken.push('open-settings');
    },
    onQuit: () => {
      taken.push('quit');
    },
  };
}

function itemLabelled(template: TrayMenuItem[], label: string): TrayMenuItem | undefined {
  return template.find((item) => item.label === label);
}

describe('the menu behind the tray icon', () => {
  test('always offers a way out of the app, because a tray can outlive every window', () => {
    const taken: string[] = [];
    const quit = itemLabelled(buildTrayMenuTemplate(recordingHandlers(taken)), 'Quit recompose');

    quit?.click?.();

    expect(taken).toEqual(['quit']);
  });

  test('brings the app back into view', () => {
    const taken: string[] = [];
    const open = itemLabelled(buildTrayMenuTemplate(recordingHandlers(taken)), 'Open recompose');

    open?.click?.();

    expect(taken).toEqual(['open-window']);
  });

  test('reaches the settings surface, which no window has to be open for', () => {
    const taken: string[] = [];
    const settings = itemLabelled(buildTrayMenuTemplate(recordingHandlers(taken)), 'Settings…');

    settings?.click?.();

    expect(taken).toEqual(['open-settings']);
  });

  test('separates the way out from the ways in', () => {
    const template = buildTrayMenuTemplate(recordingHandlers([]));
    const labels = template.map((item) => item.label ?? item.type);

    expect(labels).toEqual(['Open recompose', 'Settings…', 'separator', 'Quit recompose']);
  });
});
