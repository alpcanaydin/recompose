import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { TrayMenuHandlers } from './tray/tray-menu-template';

import { registerAppLifecycle } from './app-lifecycle';
import { hideMenuBarTray, isMenuBarTrayVisible, showMenuBarTray } from './tray/menu-bar-tray';

type Desktop = {
  ready: Promise<void>;
  announceReady: () => void;
  listeners: Map<string, () => void>;
  windowCount: number;
  quits: number;
};

const desktop = vi.hoisted(
  (): Desktop => ({
    ready: Promise.resolve(),
    announceReady: () => {},
    listeners: new Map(),
    windowCount: 0,
    quits: 0,
  }),
);

vi.mock('electron', () => {
  class TrayFake {
    private destroyed = false;

    setToolTip(): void {}

    setContextMenu(): void {}

    destroy(): void {
      this.destroyed = true;
    }

    isDestroyed(): boolean {
      return this.destroyed;
    }
  }

  const icon = {
    addRepresentation: () => {},
    setTemplateImage: () => {},
    toDataURL: () => 'data:image/png;base64,',
  };

  return {
    app: {
      whenReady: async () => desktop.ready,
      on: (event: string, listener: () => void) => {
        desktop.listeners.set(event, listener);
      },
      quit: () => {
        desktop.quits += 1;
      },
    },
    BrowserWindow: { getAllWindows: () => Array.from({ length: desktop.windowCount }) },
    Menu: { buildFromTemplate: () => null },
    nativeImage: { createFromPath: () => icon },
    Tray: TrayFake,
  };
});

type Lifecycle = {
  start: () => Promise<void>;
  activate: () => void;
  dispose: () => void;
};

type LifecycleLog = { started: number; activated: number; disposed: number };

function trackLifecycle(start: (log: LifecycleLog) => Promise<void>): {
  lifecycle: Lifecycle;
  log: LifecycleLog;
} {
  const log: LifecycleLog = { started: 0, activated: 0, disposed: 0 };

  return {
    log,
    lifecycle: {
      start: async () => {
        await start(log);
      },
      activate: () => {
        log.activated += 1;
      },
      dispose: () => {
        log.disposed += 1;
      },
    },
  };
}

async function completeStart(log: LifecycleLog): Promise<void> {
  await Promise.resolve();
  log.started += 1;
}

async function failStart(): Promise<void> {
  await Promise.resolve();

  throw new Error('the gateway port is already serving');
}

function trayHandlers(): TrayMenuHandlers {
  return {
    onOpenWindow: () => {},
    onOpenSettings: () => {},
    onQuit: () => {},
    onStartGateway: () => {},
    onStopGateway: () => {},
    onRestartGateway: () => {},
  };
}

function fire(event: string): void {
  const listener = desktop.listeners.get(event);

  if (listener === undefined) {
    throw new Error(`the app registered no ${event} listener`);
  }

  listener();
}

function runOn(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
}

let platformOfThisMachine: PropertyDescriptor | undefined;

beforeEach(() => {
  platformOfThisMachine = Object.getOwnPropertyDescriptor(process, 'platform');
  desktop.ready = new Promise<void>((resolve) => {
    desktop.announceReady = resolve;
  });
  desktop.listeners.clear();
  desktop.windowCount = 0;
  desktop.quits = 0;
});

afterEach(() => {
  hideMenuBarTray();

  if (platformOfThisMachine !== undefined) {
    Object.defineProperty(process, 'platform', platformOfThisMachine);
  }

  vi.restoreAllMocks();
});

describe('starting the app once it reports itself ready', () => {
  test('the lifecycle starts', async () => {
    const { lifecycle, log } = trackLifecycle(completeStart);

    registerAppLifecycle(lifecycle);
    desktop.announceReady();

    await vi.waitFor(() => {
      expect(log.started).toBe(1);
    });
  });

  test('a start that fails is reported instead of taking the app down with it', async () => {
    const reported: unknown[][] = [];

    vi.spyOn(console, 'error').mockImplementation((...report: unknown[]) => {
      reported.push(report);
    });

    const { lifecycle } = trackLifecycle(failStart);

    registerAppLifecycle(lifecycle);
    desktop.announceReady();

    await vi.waitFor(() => {
      expect(reported).toHaveLength(1);
    });

    expect(reported[0]).toEqual([
      'recompose failed to start',
      new Error('the gateway port is already serving'),
    ]);
  });
});

describe('answering an activate from the dock', () => {
  test('with nothing on screen the app opens a window again', () => {
    const { lifecycle, log } = trackLifecycle(completeStart);

    registerAppLifecycle(lifecycle);
    fire('activate');

    expect(log.activated).toBe(1);
  });

  test('with a window already open the app leaves it alone', () => {
    const { lifecycle, log } = trackLifecycle(completeStart);

    registerAppLifecycle(lifecycle);
    desktop.windowCount = 1;
    fire('activate');

    expect(log.activated).toBe(0);
  });
});

describe('shutting down when the app is quitting', () => {
  test('the menu bar tray goes away and the lifecycle is disposed', () => {
    const { lifecycle, log } = trackLifecycle(completeStart);

    registerAppLifecycle(lifecycle);
    showMenuBarTray(trayHandlers());

    expect(isMenuBarTrayVisible()).toBe(true);

    fire('before-quit');

    expect(isMenuBarTrayVisible()).toBe(false);
    expect(log.disposed).toBe(1);
  });
});

describe('answering the last window closing', () => {
  test('on macOS the app stays alive without a window', () => {
    const { lifecycle } = trackLifecycle(completeStart);

    registerAppLifecycle(lifecycle);
    runOn('darwin');
    fire('window-all-closed');

    expect(desktop.quits).toBe(0);
  });

  test('off macOS, with nothing left to show, the app quits', () => {
    const { lifecycle } = trackLifecycle(completeStart);

    registerAppLifecycle(lifecycle);
    runOn('linux');
    fire('window-all-closed');

    expect(desktop.quits).toBe(1);
  });

  test('off macOS the app stays alive while the menu bar tray is showing', () => {
    const { lifecycle } = trackLifecycle(completeStart);

    registerAppLifecycle(lifecycle);
    runOn('linux');
    showMenuBarTray(trayHandlers());
    fire('window-all-closed');

    expect(desktop.quits).toBe(0);
  });
});
