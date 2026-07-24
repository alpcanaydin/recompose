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

test('the built bundle boots on the app scheme with the security baseline', async ({
  electronApp,
  page,
}) => {
  const served = new URL(page.url());

  expect(served.protocol).toBe('app:');
  expect(served.host).toBe('renderer');

  const bridge = await page.evaluate(() => ({
    isObject: typeof globalThis.recompose === 'object',
    isFrozen: Object.isFrozen(globalThis.recompose),
  }));

  expect(bridge).toEqual({ isObject: true, isFrozen: true });

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
  await expect.poll(() => page.url()).toBe(beforeAttempt);
});
