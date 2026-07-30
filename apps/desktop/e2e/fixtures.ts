import type { ElectronApplication, Page } from '@playwright/test';

import { _electron as electron } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { type Server } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createBdd, test as base } from 'playwright-bdd';

import { dropServer, holdPort, LOOPBACK_HOSTS } from './loopback-ports';

const appRoot = join(__dirname, '..');

export function inheritedEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}

/**
 * Puts the machine's clipboard back the way a scenario found it.
 *
 * @summary Only a scenario that copies something asks for this, because the clipboard is one
 * resource the whole machine shares and a restore from an idle worker clobbers a live copy.
 */
type ClipboardKeeper = void;

/** Holds loopback ports away from recompose, the way a rival process on the machine would. */
export type PortSquatter = {
  take: (port: number) => Promise<void>;
  release: (port: number) => Promise<void>;
};

type ElectronFixtures = {
  electronApp: ElectronApplication;
  page: Page;
  clipboardKeeper: ClipboardKeeper;
  portSquatter: PortSquatter;
};

async function takePort(held: Map<number, Server[]>, port: number): Promise<void> {
  const holders = await Promise.all(LOOPBACK_HOSTS.map(async (host) => holdPort(host, port)));
  const bound = holders.filter((holder): holder is Server => holder !== null);

  if (bound.length === 0) {
    throw new Error(`the scenario could not take port ${String(port)} away from recompose`);
  }

  held.set(port, bound);
}

async function releasePort(held: Map<number, Server[]>, port: number): Promise<void> {
  const bound = held.get(port) ?? [];

  held.delete(port);

  await Promise.all(bound.map(dropServer));
}

function platformHoldsLoginItem(): boolean {
  return process.platform === 'darwin' || process.platform === 'win32';
}

async function readLoginItem(app: ElectronApplication): Promise<boolean | null> {
  if (!platformHoldsLoginItem()) {
    return null;
  }

  return app.evaluate(
    ({ app: runningApp }) =>
      runningApp.getLoginItemSettings({ path: process.execPath, args: [] }).openAtLogin,
  );
}

async function restoreLoginItem(
  app: ElectronApplication,
  openAtLogin: boolean | null,
): Promise<void> {
  if (openAtLogin === null) {
    return;
  }

  await app.evaluate(({ app: runningApp }, enabled) => {
    runningApp.setLoginItemSettings({ path: process.execPath, args: [], openAtLogin: enabled });
  }, openAtLogin);
}

const clipboardIsSafeToTouch = process.platform !== 'linux';

async function readClipboard(app: ElectronApplication): Promise<string | null> {
  if (!clipboardIsSafeToTouch) {
    return null;
  }

  try {
    return await app.evaluate(({ clipboard }) => clipboard.readText());
  } catch {
    return null;
  }
}

async function restoreClipboard(app: ElectronApplication, text: string | null): Promise<void> {
  if (text === null) {
    return;
  }

  try {
    await app.evaluate(({ clipboard }, held) => {
      clipboard.writeText(held);
    }, text);
  } catch {
    return;
  }
}

export const test = base.extend<ElectronFixtures>({
  electronApp: async ({}, use) => {
    const userDataDir = await mkdtemp(join(homedir(), '.recompose-e2e-'));
    const app = await electron.launch({
      args: [appRoot],
      env: {
        ...inheritedEnv(),
        NODE_ENV: 'production',
        ELECTRON_RENDERER_URL: '',
        RECOMPOSE_USER_DATA_DIR: userDataDir,
      },
    });

    app.process().stderr?.on('data', (chunk: Buffer) => {
      process.stderr.write(chunk);
    });

    try {
      const priorLoginItem = await readLoginItem(app);

      try {
        await use(app);
      } finally {
        await restoreLoginItem(app, priorLoginItem);
      }
    } finally {
      await app.close();
      await rm(userDataDir, { force: true, recursive: true });
    }
  },
  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();

    await page.emulateMedia({ colorScheme: null });

    await page.waitForLoadState('domcontentloaded');
    await use(page);
  },
  clipboardKeeper: async ({ electronApp }, use) => {
    const held = await readClipboard(electronApp);

    try {
      await use();
    } finally {
      await restoreClipboard(electronApp, held);
    }
  },
  portSquatter: async ({}, use) => {
    const held = new Map<number, Server[]>();

    try {
      await use({
        take: async (port) => takePort(held, port),
        release: async (port) => releasePort(held, port),
      });
    } finally {
      await Promise.all([...held.keys()].map(async (port) => releasePort(held, port)));
    }
  },
});

export const { Given, When, Then } = createBdd(test);
