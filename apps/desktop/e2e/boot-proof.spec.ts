import type { RecomposeIpc } from '@recompose/contracts';

import { expect } from '@playwright/test';

import { test } from './fixtures';

declare global {
  var recompose: RecomposeIpc;

  namespace Electron {
    interface WebContents {
      getLastWebPreferences: () => WebPreferences;
    }
  }
}

const NAVIGATION_GUARD_WINDOW_MS = 500;

async function assertUrlStaysUnchanged(
  detectDrift: () => string | null,
  windowMs: number,
): Promise<void> {
  const start = Date.now();

  await expect
    .poll(
      () => {
        const drift = detectDrift();

        if (drift !== null) {
          throw new Error(drift);
        }

        return Date.now() - start;
      },
      { timeout: windowMs + 4500 },
    )
    .toBeGreaterThan(windowMs);
}

test('the built bundle boots on the app scheme with the security baseline', async ({
  electronApp,
  page,
}) => {
  const served = new URL(page.url());

  expect(served.protocol).toBe('app:');
  expect(served.host).toBe('renderer');

  const bridge = await page.evaluate(() => ({
    isObject: typeof globalThis.recompose === 'object',
    isNull: Object.is(globalThis.recompose, null),
    isFrozen: Object.isFrozen(globalThis.recompose),
  }));

  expect(bridge).toEqual({ isObject: true, isNull: false, isFrozen: true });

  const answer = await page.evaluate(async () => globalThis.recompose['settings:get']());

  expect(answer.ok).toBe(true);

  const sandboxed = await electronApp.evaluate(
    ({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.webContents.getLastWebPreferences().sandbox,
  );

  expect(sandboxed).toBe(true);

  const csp = await page.evaluate(() => {
    const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');

    return meta === null ? '' : (meta.getAttribute('content') ?? '');
  });

  expect(csp).not.toBe('');
  expect(csp).not.toContain('__CSP__');
  expect(csp).not.toContain('unsafe-inline');

  const beforeAttempt = page.url();

  await page.evaluate(() => {
    globalThis.location.href = 'https://example.com/';
  });

  await assertUrlStaysUnchanged(
    () => (page.url() === beforeAttempt ? null : `url changed to ${page.url()}`),
    NAVIGATION_GUARD_WINDOW_MS,
  );
});
