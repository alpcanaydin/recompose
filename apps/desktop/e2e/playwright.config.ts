import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const acceptanceDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: ['steps/**/*.ts', 'fixtures.ts'],
  outputDir: '.features-gen',
});

/**
 * How many whole Electron applications one machine can bring up at the same time.
 *
 * @summary Every worker launches an application rather than a browser context. Left to pick its
 * own count, Playwright takes half the cores and the launches starve each other, which surfaces
 * as `firstWindow` crossing the test timeout rather than as anything a scenario did.
 */
const ELECTRON_LAUNCHES_AT_ONCE = 2;

export default defineConfig({
  timeout: 30_000,
  workers: ELECTRON_LAUNCHES_AT_ONCE,
  retries: process.env['CI'] === undefined ? 0 : 2,
  use: { trace: 'on-first-retry' },
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}-{platform}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixels: 0 } },
  projects: [
    { name: 'acceptance', testDir: acceptanceDir },
    { name: 'proofs', testMatch: /boot-proof\.spec\.ts/ },
    { name: 'leak', testMatch: /leak\.spec\.ts/ },
    { name: 'packaged', testMatch: /packaged-(smoke|icons)\.spec\.ts/, timeout: 120_000 },
    { name: 'visual', testMatch: /visual\.spec\.ts/ },
  ],
});
