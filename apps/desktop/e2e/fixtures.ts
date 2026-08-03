import type { ElectronApplication, Page } from '@playwright/test';

import { _electron as electron } from '@playwright/test';
import { mkdir, rm } from 'node:fs/promises';
import { type Server } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createBdd, test as base } from 'playwright-bdd';

import type { KeyProbeStub } from './key-probe-stub';
import type { SubscriptionTools } from './subscription-tools';

import { fakeKeyProbe } from './key-probe-stub';
import { dropServer, holdPort, LOOPBACK_HOSTS } from './loopback-ports';
import { fakeSubscriptionTools } from './subscription-tools';

const appRoot = join(__dirname, '..');

export function inheritedEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}

/** Holds loopback ports away from recompose, the way a rival process on the machine would. */
export type PortSquatter = {
  take: (port: number) => Promise<void>;
  release: (port: number) => Promise<void>;
};

type ElectronFixtures = {
  electronApp: ElectronApplication;
  keyProbe: KeyProbeStub;
  page: Page;
  portSquatter: PortSquatter;
  subscriptionTools: SubscriptionTools;
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

export const test = base.extend<ElectronFixtures>({
  subscriptionTools: async ({}, use) => {
    const tools = await fakeSubscriptionTools();

    try {
      await use(tools);
    } finally {
      await tools.dispose();
    }
  },
  keyProbe: async ({}, use) => {
    const probe = await fakeKeyProbe();

    try {
      await use(probe);
    } finally {
      await probe.dispose();
    }
  },
  electronApp: async ({ keyProbe, subscriptionTools }, use, testInfo) => {
    const userDataDir = join(homedir(), `.recompose-e2e-w${String(testInfo.parallelIndex)}`);

    await rm(userDataDir, { force: true, recursive: true });
    await mkdir(userDataDir, { recursive: true });
    const app = await electron.launch({
      args: [appRoot],
      env: subscriptionTools.env({
        ...inheritedEnv(),
        NODE_ENV: 'production',
        ELECTRON_RENDERER_URL: '',
        RECOMPOSE_USER_DATA_DIR: userDataDir,
        RECOMPOSE_PROBE_ORIGIN: keyProbe.origin,
      }),
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
