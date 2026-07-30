import { type EngineStates } from '@recompose/contracts';
import { describe, expect, test } from 'vitest';

import type { TrayMenuHandlers, TrayMenuItem } from './tray-menu-template';

import { buildTrayMenuTemplate } from './tray-menu-template';

const icons = {
  start: { source: 'start.png', retinaSource: 'start@2x.png' },
  stop: { source: 'stop.png', retinaSource: 'stop@2x.png' },
  restart: { source: 'restart.png', retinaSource: 'restart@2x.png' },
};

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
    onStartGateway: (slug) => {
      taken.push(`start ${slug}`);
    },
    onStopGateway: (slug) => {
      taken.push(`stop ${slug}`);
    },
    onRestartGateway: (slug) => {
      taken.push(`restart ${slug}`);
    },
  };
}

const codex = { slug: 'codex', displayName: 'Codex' };
const gemini = { slug: 'gemini', displayName: 'Gemini' };

function templateFor(states: EngineStates, taken: string[] = []): TrayMenuItem[] {
  return buildTrayMenuTemplate({
    handlers: recordingHandlers(taken),
    icons,
    gateways: [codex],
    states,
  });
}

function itemLabelled(template: TrayMenuItem[], label: string): TrayMenuItem | undefined {
  return template
    .flatMap((item) => [item, ...(item.submenu ?? [])])
    .find((item) => item.label === label);
}

function submenuOf(template: TrayMenuItem[], label: string): TrayMenuItem[] {
  return itemLabelled(template, label)?.submenu ?? [];
}

function availability(template: TrayMenuItem[], gateway: string): Record<string, boolean> {
  const rows = submenuOf(template, gateway).map((item): [string, boolean] => [
    item.label ?? '',
    item.enabled !== false,
  ]);

  return Object.fromEntries(rows);
}

describe('the menu behind the tray icon, with no gateway stored', () => {
  test('separates the way out from the ways in', () => {
    const empty = buildTrayMenuTemplate({
      handlers: recordingHandlers([]),
      icons,
      gateways: [],
      states: {},
    });

    expect(empty.map((item) => item.label ?? item.type)).toEqual([
      'Open recompose',
      'Settings…',
      'separator',
      'Quit recompose',
    ]);
  });

  test('always offers a way out of the app, because a tray can outlive every window', () => {
    const taken: string[] = [];

    itemLabelled(templateFor({}, taken), 'Quit recompose')?.click?.();

    expect(taken).toEqual(['quit']);
  });

  test('brings the app back into view', () => {
    const taken: string[] = [];

    itemLabelled(templateFor({}, taken), 'Open recompose')?.click?.();

    expect(taken).toEqual(['open-window']);
  });

  test('reaches the settings surface, which no window has to be open for', () => {
    const taken: string[] = [];

    itemLabelled(templateFor({}, taken), 'Settings…')?.click?.();

    expect(taken).toEqual(['open-settings']);
  });
});

describe('where the gateways stand in the menu', () => {
  test('every stored gateway carries its own submenu, between the ways in and the way out', () => {
    const template = buildTrayMenuTemplate({
      handlers: recordingHandlers([]),
      icons,
      gateways: [codex, gemini],
      states: {},
    });

    expect(template.map((item) => item.label ?? item.type)).toEqual([
      'Open recompose',
      'Settings…',
      'separator',
      'Codex',
      'Gemini',
      'separator',
      'Quit recompose',
    ]);
  });

  test('a gateway is named the way a person named it, not by its slug', () => {
    expect(itemLabelled(templateFor({}), 'Codex')).toBeDefined();
    expect(itemLabelled(templateFor({}), 'codex')).toBeUndefined();
  });
});

describe('what a gateway submenu offers', () => {
  test('the submenu keeps one shape whatever the gateway is doing', () => {
    const running = submenuOf(templateFor({ codex: { status: 'running' } }), 'Codex');
    const stopped = submenuOf(templateFor({ codex: { status: 'stopped' } }), 'Codex');

    expect(running.map((item) => item.label)).toEqual(['Start', 'Stop', 'Restart']);
    expect(stopped.map((item) => item.label)).toEqual(['Start', 'Stop', 'Restart']);
  });

  test('a running gateway offers stop and restart, and shows start as unavailable', () => {
    expect(availability(templateFor({ codex: { status: 'running' } }), 'Codex')).toEqual({
      Start: false,
      Stop: true,
      Restart: true,
    });
  });

  test('a stopped gateway offers start, and shows stop and restart as unavailable', () => {
    expect(availability(templateFor({ codex: { status: 'stopped' } }), 'Codex')).toEqual({
      Start: true,
      Stop: false,
      Restart: false,
    });
  });

  test('a gateway the ledger has not heard from yet reads stopped', () => {
    expect(availability(templateFor({}), 'Codex')).toEqual({
      Start: true,
      Stop: false,
      Restart: false,
    });
  });

  test('a failed start still reads stopped, so the submenu offers the retry', () => {
    const states: EngineStates = { codex: { status: 'stopped', failure: { port: 8397 } } };

    expect(availability(templateFor(states), 'Codex')).toEqual({
      Start: true,
      Stop: false,
      Restart: false,
    });
  });

  test('each lifecycle entry carries its own icon', () => {
    expect(submenuOf(templateFor({}), 'Codex').map((item) => item.icon)).toEqual([
      icons.start,
      icons.stop,
      icons.restart,
    ]);
  });
});

describe('choosing a lifecycle entry', () => {
  test('starting reaches the gateway whose submenu it sits in', () => {
    const taken: string[] = [];

    itemLabelled(templateFor({ codex: { status: 'stopped' } }, taken), 'Start')?.click?.();

    expect(taken).toEqual(['start codex']);
  });

  test('stopping reaches the gateway whose submenu it sits in', () => {
    const taken: string[] = [];

    itemLabelled(templateFor({ codex: { status: 'running' } }, taken), 'Stop')?.click?.();

    expect(taken).toEqual(['stop codex']);
  });

  test('restarting reaches the gateway whose submenu it sits in', () => {
    const taken: string[] = [];

    itemLabelled(templateFor({ codex: { status: 'running' } }, taken), 'Restart')?.click?.();

    expect(taken).toEqual(['restart codex']);
  });

  test('one gateway submenu never reaches another gateway', () => {
    const taken: string[] = [];
    const template = buildTrayMenuTemplate({
      handlers: recordingHandlers(taken),
      icons,
      gateways: [codex, gemini],
      states: { codex: { status: 'running' }, gemini: { status: 'running' } },
    });

    submenuOf(template, 'Gemini')
      .find((item) => item.label === 'Stop')
      ?.click?.();

    expect(taken).toEqual(['stop gemini']);
  });
});
