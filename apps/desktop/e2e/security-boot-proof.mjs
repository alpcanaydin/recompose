import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const app = await electron.launch({
  args: [appRoot],
  env: { ...process.env, NODE_ENV: 'production', ELECTRON_RENDERER_URL: '' },
});

const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');

const served = new URL(page.url());
assert.equal(served.protocol, 'app:');
assert.equal(served.host, 'renderer');

const bridgeFrozen = await page.evaluate(() => Object.isFrozen(globalThis.recompose));
assert.equal(bridgeFrozen, true);

const sandboxed = await app.evaluate(
  ({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences().sandbox,
);
assert.equal(sandboxed, true);

await page.evaluate(() => {
  globalThis.location.href = 'https://example.com/';
});
await page.waitForTimeout(500);
assert.equal(new URL(page.url()).protocol, 'app:');

await app.close();
console.log('security boot proof passed');
