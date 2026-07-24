import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const app = await electron.launch({
  args: [appRoot],
  env: { ...process.env, NODE_ENV: 'production', ELECTRON_RENDERER_URL: '' },
});

try {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  const served = new URL(page.url());
  assert.equal(served.protocol, 'app:');
  assert.equal(served.host, 'renderer');

  const bridge = await page.evaluate(() => ({
    isObject: typeof globalThis.recompose === 'object' && globalThis.recompose !== null,
    isFrozen: Object.isFrozen(globalThis.recompose),
  }));
  assert.equal(bridge.isObject, true, 'bridge missing from globalThis');
  assert.equal(bridge.isFrozen, true, 'bridge not frozen');

  const answer = await page.evaluate(() => globalThis.recompose['settings:get']());
  assert.equal(typeof answer.ok, 'boolean', 'bridge did not answer with a result envelope');
  assert.equal(answer.ok, true, 'settings:get did not reach the real handler');

  const sandboxed = await app.evaluate(
    ({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences().sandbox,
  );
  assert.equal(sandboxed, true, 'live window not sandboxed');

  const csp = await page.evaluate(() => {
    const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    return meta === null ? '' : (meta.getAttribute('content') ?? '');
  });
  assert.notEqual(csp, '', 'csp meta tag missing from the served document');
  assert.equal(csp.includes('__CSP__'), false, 'csp placeholder left in the served document');
  assert.equal(csp.includes('unsafe-inline'), false, 'production csp allows inline styles');

  const beforeAttempt = page.url();
  await page.evaluate(() => {
    globalThis.location.href = 'https://example.com/';
  });
  await page.waitForTimeout(500);
  assert.equal(page.url(), beforeAttempt, 'navigation guard did not hold');
} finally {
  await app.close();
}
console.log('security boot proof passed');
