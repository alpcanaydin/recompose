import type { Browser, Page } from '@playwright/test';
import type { RecomposeIpc } from '@recompose/contracts';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';

import { chromium, expect, test } from '@playwright/test';
import { findLatestBuild, parseElectronApp } from 'electron-playwright-helpers';
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { inheritedEnv } from './fixtures';

declare global {
  var recompose: RecomposeIpc;
}

const distDir = join(__dirname, '..', 'dist');
const FUSE_PROBE_WINDOW_MS = 2000;
const DEVTOOLS_LISTENING_PATTERN = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//;

async function createPackagedLaunchEnv(
  overrides: Record<string, string>,
): Promise<Record<string, string>> {
  const userDataDir = await mkdtemp(join(tmpdir(), 'recompose-packaged-'));

  return {
    ...inheritedEnv(),
    NODE_ENV: 'production',
    ELECTRON_RENDERER_URL: '',
    RECOMPOSE_USER_DATA_DIR: userDataDir,
    ...overrides,
  };
}

function trackChildFailure(
  child: ChildProcessWithoutNullStreams,
  operation: string,
): () => string | null {
  let failure: string | null = null;

  child.on('error', (error) => {
    failure = `${operation} failed: ${error.message}`;
  });

  return () => failure;
}

async function waitForDevtoolsPort(
  child: ChildProcessWithoutNullStreams,
  getSpawnFailure: () => string | null,
): Promise<number> {
  let buffer = '';

  child.stdout.on('data', () => {
    return undefined;
  });
  child.stderr.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
  });

  await expect
    .poll(() => {
      const spawnFailure = getSpawnFailure();

      if (spawnFailure !== null) {
        throw new Error(spawnFailure);
      }

      return DEVTOOLS_LISTENING_PATTERN.test(buffer);
    })
    .toBe(true);

  const match = DEVTOOLS_LISTENING_PATTERN.exec(buffer);

  if (match?.[1] === undefined) {
    throw new Error('devtools listening line did not carry a port number');
  }

  return Number(match[1]);
}

async function findRendererPage(browser: Browser): Promise<Page> {
  const rendererPages = () =>
    browser
      .contexts()
      .flatMap((context) => context.pages())
      .filter((candidate) => candidate.url().startsWith('app://renderer'));

  await expect.poll(() => rendererPages().length).toBeGreaterThan(0);

  const renderer = rendererPages()[0];

  expect(renderer).toBeDefined();

  if (renderer === undefined) {
    throw new Error("no app://renderer page found on the packaged binary's devtools endpoint");
  }

  return renderer;
}

async function assertNoEarlyFailure(
  detectFailure: () => string | null,
  windowMs: number,
): Promise<void> {
  const start = Date.now();

  await expect
    .poll(() => {
      const failure = detectFailure();

      if (failure !== null) {
        throw new Error(failure);
      }

      return Date.now() - start;
    })
    .toBeGreaterThan(windowMs);
}

test('the packaged artifact boots from the asar on the app scheme', async () => {
  const appInfo = parseElectronApp(findLatestBuild(distDir));

  expect(appInfo.asar).toBe(true);

  const child = spawn(appInfo.executable, ['--remote-debugging-port=0'], {
    env: await createPackagedLaunchEnv({}),
  });
  const getSpawnFailure = trackChildFailure(child, 'packaged binary spawn');

  try {
    const port = await waitForDevtoolsPort(child, getSpawnFailure);
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${String(port)}`);

    try {
      const renderer = await findRendererPage(browser);

      const bridge = await renderer.evaluate(() => ({
        isFrozen: Object.isFrozen(globalThis.recompose),
      }));

      expect(bridge.isFrozen).toBe(true);
    } finally {
      await browser.close();
    }
  } finally {
    child.kill();
  }
});

test('the run-as-node fuse stays flipped in the packaged binary', async () => {
  const appInfo = parseElectronApp(findLatestBuild(distDir));

  const child = spawn(appInfo.executable, ['-e', 'process.exit(97)'], {
    env: await createPackagedLaunchEnv({ ELECTRON_RUN_AS_NODE: '1' }),
  });
  const getSpawnFailure = trackChildFailure(child, 'run-as-node fuse probe spawn');

  child.stdout.on('data', () => {
    return undefined;
  });
  child.stderr.on('data', () => {
    return undefined;
  });

  try {
    await assertNoEarlyFailure(
      () =>
        getSpawnFailure() ??
        (child.exitCode === null ? null : `exited early with code ${String(child.exitCode)}`),
      FUSE_PROBE_WINDOW_MS,
    );
  } finally {
    child.kill();
  }
});

test('the inspect-cli-arguments fuse stays flipped in the packaged binary', async () => {
  const appInfo = parseElectronApp(findLatestBuild(distDir));

  const child = spawn(appInfo.executable, ['--inspect=0'], {
    env: await createPackagedLaunchEnv({}),
  });
  const getSpawnFailure = trackChildFailure(child, 'inspect-cli-arguments fuse probe spawn');

  let stderr = '';

  child.stdout.on('data', () => {
    return undefined;
  });
  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  try {
    await assertNoEarlyFailure(
      () =>
        getSpawnFailure() ??
        (stderr.includes('Debugger listening')
          ? 'debugger listening line appeared on stderr'
          : null),
      FUSE_PROBE_WINDOW_MS,
    );
  } finally {
    child.kill();
  }
});
