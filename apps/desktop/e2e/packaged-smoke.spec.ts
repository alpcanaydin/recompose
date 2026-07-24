import type { RecomposeIpc } from '@recompose/contracts';

import { _electron as electron, expect, test } from '@playwright/test';
import { findLatestBuild, parseElectronApp } from 'electron-playwright-helpers';
import { join } from 'node:path';

import { inheritedEnv } from './fixtures';

declare global {
  var recompose: RecomposeIpc;
}

const distDir = join(__dirname, '..', 'dist');

test('the packaged artifact boots from the asar on the app scheme', async () => {
  const appInfo = parseElectronApp(findLatestBuild(distDir));

  expect(appInfo.asar).toBe(true);

  const app = await electron.launch({
    args: [appInfo.main],
    executablePath: appInfo.executable,
    env: { ...inheritedEnv(), NODE_ENV: 'production', ELECTRON_RENDERER_URL: '' },
  });

  try {
    const page = await app.firstWindow();

    await page.waitForLoadState('domcontentloaded');

    const served = new URL(page.url());

    expect(served.protocol).toBe('app:');
    expect(served.host).toBe('renderer');

    const packagedPaths = await app.evaluate(({ app: packagedApp }) => ({
      isPackaged: packagedApp.isPackaged,
      appPath: packagedApp.getAppPath(),
    }));

    expect(packagedPaths.isPackaged).toBe(true);
    expect(packagedPaths.appPath.endsWith('app.asar')).toBe(true);

    const bridge = await page.evaluate(() => ({
      isFrozen: Object.isFrozen(globalThis.recompose),
    }));

    expect(bridge.isFrozen).toBe(true);
  } finally {
    await app.close();
  }
});

test('the run-as-node fuse stays flipped in the packaged binary', async () => {
  const appInfo = parseElectronApp(findLatestBuild(distDir));

  const app = await electron.launch({
    args: [appInfo.main],
    executablePath: appInfo.executable,
    env: {
      ...inheritedEnv(),
      NODE_ENV: 'production',
      ELECTRON_RENDERER_URL: '',
      ELECTRON_RUN_AS_NODE: '1',
    },
  });

  try {
    const page = await app.firstWindow();

    await page.waitForLoadState('domcontentloaded');
    expect(new URL(page.url()).protocol).toBe('app:');
  } finally {
    await app.close();
  }
});
