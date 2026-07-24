# Playwright end-to-end implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A required three-platform e2e layer: playwright-bdd acceptance over the built `out/` bundle, a packaged-artifact smoke per issue #58, a heap-growth leak spec, and a quarantine lane, all wired into `ci-success`.

**Architecture:** Gherkin `.feature` files compile to Playwright tests through `defineBddConfig`; a fixture launches the built Electron app with a throwaway user-data directory provided by a `RECOMPOSE_USER_DATA_DIR` seam in the main process. Plain Playwright specs cover the technical proofs (boot proof, packaged smoke, leak). One CI matrix job runs all of it on macOS, Windows, and Linux.

**Tech Stack:** Playwright 1.61.1, @playwright/test 1.61.1, playwright-bdd 9.2.0, electron-playwright-helpers 2.1.0, Electron 43, electron-builder 26.

## Parallel execution map

- **Group A (parallel):** Task 1, Task 2 — disjoint files.
- **Group B (parallel, after Group A):** Task 3, Task 4, Task 5, Task 6 — each adds its own files only; the shared config and fixtures are frozen by Task 1.
- **Sequential tail:** Task 7, then Task 8.
- Parallel implementers each commit only their own files. If `git commit` hits a lock from a sibling, retry after it clears.
- The controller runs `pnpm build` once before dispatching Group B; implementers skip the build when `apps/desktop/out` already exists, so concurrent builds never race on `out/`.

## Global Constraints

- New devDependencies pin exact (`-E`). `@playwright/test` must be exactly `1.61.1` to match the existing `playwright` pin.
- Never commit to `main`. Work happens on `worktree-playwright`.
- The word between "r" and "yz" formed by the letter "e" never appears in any artifact (gitleaks blocks it).
- No code comments except JSDoc sanctioned by ADR-0029 and inexpressible constraints.
- Every commit message goes through the caveman-commit skill; trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Feature files follow the `gherkin-best-practices` skill; step definitions and specs follow `playwright-best-practices` (role-based locators, web-first assertions, no `waitForTimeout`).
- No em dash in any authored prose.
- CI actions pin by full commit SHA (zizmor enforces).
- `ci-success` is the only ruleset-required check; new required jobs join its `needs` list (ADR-0007).

---

### Task 1: Runner foundation (Group A)

**Files:**

- Modify: `apps/desktop/package.json` (devDeps + scripts)
- Create: `apps/desktop/e2e/playwright.config.ts`
- Create: `apps/desktop/e2e/fixtures.ts`
- Modify: `apps/desktop/tsconfig.node.json` (include e2e)
- Modify: `knip.json` (desktop entries)
- Modify: `.gitignore` (runner outputs)
- Modify: root `package.json` (root script)

**Interfaces:**

- Produces: `test` and `Given/When/Then` exported from `e2e/fixtures.ts`; fixture names `electronApp: ElectronApplication` and `page: Page`; projects named `acceptance`, `proofs`, `leak`, `packaged`; scripts `test:e2e`, `test:e2e:leak`, `test:e2e:packaged`, `test:e2e:quarantine`.

- [ ] **Step 1: Install pinned devDependencies**

```bash
pnpm --filter @recompose/desktop add -DE @playwright/test@1.61.1 playwright-bdd@9.2.0 electron-playwright-helpers@2.1.0
```

- [ ] **Step 2: Create `apps/desktop/e2e/playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const acceptanceDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: ['steps/**/*.ts', 'fixtures.ts'],
  outputDir: '.features-gen',
});

export default defineConfig({
  timeout: 30_000,
  retries: process.env['CI'] === undefined ? 0 : 2,
  use: { trace: 'on-first-retry' },
  projects: [
    { name: 'acceptance', testDir: acceptanceDir },
    { name: 'proofs', testMatch: /boot-proof\.spec\.ts/ },
    { name: 'leak', testMatch: /leak\.spec\.ts/ },
    { name: 'packaged', testMatch: /packaged-smoke\.spec\.ts/ },
  ],
});
```

- [ ] **Step 3: Create `apps/desktop/e2e/fixtures.ts`**

```ts
import type { ElectronApplication, Page } from '@playwright/test';

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { test as base, _electron as electron } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const appRoot = join(__dirname, '..');

export function inheritedEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}

type ElectronFixtures = {
  electronApp: ElectronApplication;
  page: Page;
};

export const test = base.extend<ElectronFixtures>({
  electronApp: async ({}, use) => {
    const userDataDir = await mkdtemp(join(tmpdir(), 'recompose-e2e-'));
    const app = await electron.launch({
      args: [appRoot],
      env: {
        ...inheritedEnv(),
        NODE_ENV: 'production',
        ELECTRON_RENDERER_URL: '',
        RECOMPOSE_USER_DATA_DIR: userDataDir,
      },
    });
    await use(app);
    await app.close();
  },
  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await use(page);
  },
});

export const { Given, When, Then } = createBdd(test);
```

- [ ] **Step 4: Add scripts to `apps/desktop/package.json`**

Add to `"scripts"`:

```json
"test:e2e": "playwright test -c e2e/playwright.config.ts --project acceptance --project proofs --grep-invert @quarantine",
"test:e2e:leak": "playwright test -c e2e/playwright.config.ts --project leak --grep-invert @quarantine",
"test:e2e:packaged": "playwright test -c e2e/playwright.config.ts --project packaged --grep-invert @quarantine",
"test:e2e:quarantine": "playwright test -c e2e/playwright.config.ts --grep @quarantine --pass-with-no-tests"
```

Add to root `package.json` scripts:

```json
"test:e2e": "pnpm --filter @recompose/desktop run test:e2e"
```

- [ ] **Step 5: Include e2e in `apps/desktop/tsconfig.node.json`**

Add `"e2e/**/*"` to the `include` array.

- [ ] **Step 6: Update `knip.json` desktop entries**

Replace the `apps/desktop` entry array with:

```json
"entry": [
  "build/after-pack.cjs",
  "e2e/playwright.config.ts",
  "e2e/fixtures.ts",
  "e2e/*.spec.ts",
  "e2e/steps/**/*.ts"
]
```

(The old `e2e/security-boot-proof.mjs` entry disappears in Task 4; leave it in place for now so knip stays green, and list it alongside the new entries.)

- [ ] **Step 7: Ignore runner outputs**

Check each and append missing lines to `.gitignore`:

```bash
git check-ignore -q apps/desktop/dist || echo needs-dist-ignore
```

Append (only what's missing):

```text
.features-gen/
test-results/
playwright-report/
```

- [ ] **Step 8: Verify gates**

```bash
pnpm run typecheck && pnpm exec knip && pnpm run lint:root
```

Expected: all pass. Don't run the playwright CLI yet: `defineBddConfig` fails while zero `.feature` files exist, and Task 3 delivers them; typecheck covering `e2e/**/*` through `tsconfig.node.json` is this task's proof.

- [ ] **Step 9: Commit**

```bash
git add apps/desktop/package.json apps/desktop/e2e apps/desktop/tsconfig.node.json knip.json .gitignore package.json pnpm-lock.yaml
git commit -m "test(e2e): playwright-bdd runner foundation"
```

---

### Task 2: User-data seam in the main process (Group A)

**Files:**

- Create: `apps/desktop/src/main/user-data-override.ts`
- Create: `apps/desktop/src/main/user-data-override.test.ts`
- Modify: `apps/desktop/src/main/index.ts`

**Interfaces:**

- Produces: `resolveUserDataOverride(env: Record<string, string | undefined>): string | null`. The e2e fixture (Task 1) sets `RECOMPOSE_USER_DATA_DIR`; this seam makes the app honor it.

- [ ] **Step 1: Write the failing behavior spec** (`user-data-override.test.ts`)

```ts
import { describe, expect, it } from 'vitest';

import { resolveUserDataOverride } from './user-data-override';

describe('user data override', () => {
  it('resolves to the directory the environment names', () => {
    const override = resolveUserDataOverride({ RECOMPOSE_USER_DATA_DIR: '/tmp/e2e-data' });

    expect(override).toBe('/tmp/e2e-data');
  });

  it('leaves the default location when the environment names nothing', () => {
    expect(resolveUserDataOverride({})).toBeNull();
  });

  it('leaves the default location when the override is empty', () => {
    expect(resolveUserDataOverride({ RECOMPOSE_USER_DATA_DIR: '' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm --filter @recompose/desktop exec vitest run --project unit src/main/user-data-override.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement** (`user-data-override.ts`)

```ts
export function resolveUserDataOverride(env: Record<string, string | undefined>): string | null {
  const override = env['RECOMPOSE_USER_DATA_DIR'];

  return override === undefined || override === '' ? null : override;
}
```

- [ ] **Step 4: Run to verify pass**

Same command as Step 2. Expected: 3 passing.

- [ ] **Step 5: Wire into `apps/desktop/src/main/index.ts`**

Immediately after the import block (before `registerAppScheme()` and before anything reads `app.getPath('userData')`), add:

```ts
const userDataOverride = resolveUserDataOverride(process.env);

if (userDataOverride !== null) {
  app.setPath('userData', userDataOverride);
}
```

with the import `import { resolveUserDataOverride } from './user-data-override';` in the existing import block.

- [ ] **Step 6: Verify gates**

```bash
pnpm --filter @recompose/desktop run typecheck && pnpm --filter @recompose/desktop run test
```

Expected: all pass; coverage unaffected (the new file is fully covered, `index.ts` is coverage-excluded).

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/main/user-data-override.ts apps/desktop/src/main/user-data-override.test.ts apps/desktop/src/main/index.ts
git commit -m "feat(desktop): honor a user-data directory override"
```

---

### Task 3: Acceptance features and steps (Group B)

**Files:**

- Create: `apps/desktop/e2e/features/home.feature`
- Create: `apps/desktop/e2e/features/providers.feature`
- Create: `apps/desktop/e2e/steps/app.steps.ts`
- Create: `apps/desktop/e2e/steps/providers.steps.ts`

**Interfaces:**

- Consumes: `test`, `Given/When/Then`, `page` fixture from `e2e/fixtures.ts` (Task 1); the seam from Task 2 gives each scenario a clean data directory automatically.

Read `.claude/skills/gherkin-best-practices/SKILL.md` and the `playwright-best-practices` skill's `core/locators.md` before writing. UI facts: the sidebar has links "Gateways" and "Providers"; home shows the paragraph "Select a gateway or create one to get started."; the connect form has labeled fields "Provider", "Kind", "Label", "Secret" and a "Connect" button; each listed account renders a "Remove {label}" button.

- [ ] **Step 1: Write `home.feature`**

```gherkin
Feature: First launch

  Scenario: A fresh install greets with the gateway empty state
    Given the app is on the gateways screen
    Then it offers to select a gateway or create one
```

- [ ] **Step 2: Write `providers.feature`**

```gherkin
Feature: Provider accounts

  Scenario: Connecting the first account lists it
    Given the app is on the providers screen
    When the maintainer connects an "anthropic" api-key account labeled "Work"
    Then the providers list shows the "Work" account for "anthropic"

  Scenario: Removing the only account empties the list
    Given the app is on the providers screen
    And a connected "anthropic" api-key account labeled "Work"
    When the maintainer removes the "Work" account
    Then the providers list is empty
```

- [ ] **Step 3: Write `steps/app.steps.ts`**

```ts
import { expect } from '@playwright/test';

import { Given, Then } from '../fixtures';

Given('the app is on the gateways screen', async ({ page }) => {
  await page.getByRole('link', { name: 'Gateways' }).click();
});

Given('the app is on the providers screen', async ({ page }) => {
  await page.getByRole('link', { name: 'Providers' }).click();
  await expect(page.getByRole('heading', { name: 'Providers' })).toBeVisible();
});

Then('it offers to select a gateway or create one', async ({ page }) => {
  await expect(page.getByText('Select a gateway or create one to get started.')).toBeVisible();
});
```

- [ ] **Step 4: Write `steps/providers.steps.ts`**

```ts
import { expect } from '@playwright/test';

import { Given, Then, When } from '../fixtures';

async function connectAccount(
  page: import('@playwright/test').Page,
  provider: string,
  label: string,
): Promise<void> {
  await page.getByRole('textbox', { name: 'Provider' }).fill(provider);
  await page.getByRole('textbox', { name: 'Label' }).fill(label);
  await page.getByRole('textbox', { name: 'Secret' }).fill('not-a-real-secret');
  await page.getByRole('button', { name: 'Connect' }).click();
}

When(
  'the maintainer connects an {string} api-key account labeled {string}',
  async ({ page }, provider: string, label: string) => {
    await connectAccount(page, provider, label);
  },
);

Given(
  'a connected {string} api-key account labeled {string}',
  async ({ page }, provider: string, label: string) => {
    await connectAccount(page, provider, label);
    await expect(page.getByRole('listitem').filter({ hasText: label })).toBeVisible();
  },
);

When('the maintainer removes the {string} account', async ({ page }, label: string) => {
  await page.getByRole('button', { name: `Remove ${label}` }).click();
});

Then(
  'the providers list shows the {string} account for {string}',
  async ({ page }, label: string, provider: string) => {
    const item = page.getByRole('listitem').filter({ hasText: label });

    await expect(item).toBeVisible();
    await expect(item).toContainText(provider);
  },
);

Then('the providers list is empty', async ({ page }) => {
  await expect(page.getByRole('listitem')).toHaveCount(0);
});
```

- [ ] **Step 5: Build and run to verify failure-then-pass**

```bash
pnpm build
pnpm --filter @recompose/desktop exec playwright test -c e2e/playwright.config.ts --project acceptance --grep-invert @quarantine
```

(Skip `pnpm build` when `apps/desktop/out` already exists.) Run only the `acceptance` project here: the `proofs` project belongs to a parallel task and may not exist yet.

Expected: 3 scenarios pass. If a locator misses, fix the step (never the feature wording) and re-run.

- [ ] **Step 6: Verify gates**

```bash
pnpm run typecheck && pnpm run lint:root && pnpm exec knip
```

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/e2e/features apps/desktop/e2e/steps
git commit -m "test(e2e): home and providers acceptance scenarios"
```

---

### Task 4: Boot-proof migration (Group B)

**Files:**

- Create: `apps/desktop/e2e/boot-proof.spec.ts`
- Delete: `apps/desktop/e2e/security-boot-proof.mjs`
- Modify: `knip.json` (drop the `.mjs` entry)

**Interfaces:**

- Consumes: `test` and `page`/`electronApp` fixtures from `e2e/fixtures.ts` (Task 1). Scope stays exactly the current `security-boot-proof.mjs` assertions.

- [ ] **Step 1: Write `boot-proof.spec.ts`**

```ts
import { expect } from '@playwright/test';

import { test } from './fixtures';

test('the built bundle boots on the app scheme with the security baseline', async ({
  electronApp,
  page,
}) => {
  const served = new URL(page.url());
  expect(served.protocol).toBe('app:');
  expect(served.host).toBe('renderer');

  const bridge = await page.evaluate(() => ({
    isObject: typeof globalThis.recompose === 'object' && globalThis.recompose !== null,
    isFrozen: Object.isFrozen(globalThis.recompose),
  }));
  expect(bridge).toEqual({ isObject: true, isFrozen: true });

  const answer = await page.evaluate(() => globalThis.recompose['settings:get']());
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
  await expect(page).toHaveURL(beforeAttempt);
});
```

Type note: the `.mjs` original accessed `globalThis.recompose` untyped. In TS, reuse whatever ambient declaration the renderer uses for `window.recompose` (see `apps/desktop/src/preload/index.d.ts`); if `globalThis.recompose` doesn't typecheck inside `page.evaluate`, type the evaluate callbacks against the `RecomposeIpc` contract imported from `@recompose/contracts`. No `as` casts.

- [ ] **Step 2: Build and run**

```bash
pnpm build
pnpm --filter @recompose/desktop exec playwright test -c e2e/playwright.config.ts --project proofs
```

Expected: 1 passing.

- [ ] **Step 3: Delete the old script and its knip entry**

```bash
git rm apps/desktop/e2e/security-boot-proof.mjs
```

Remove `"e2e/security-boot-proof.mjs"` from `knip.json` if present.

- [ ] **Step 4: Verify gates**

```bash
pnpm run typecheck && pnpm exec knip && pnpm run lint:root
```

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/e2e/boot-proof.spec.ts knip.json
git commit -m "test(e2e): migrate the security boot proof into the runner"
```

---

### Task 5: Packaged-artifact smoke (Group B, closes issue #58)

**Files:**

- Create: `apps/desktop/e2e/packaged-smoke.spec.ts`

**Interfaces:**

- Consumes: `inheritedEnv()` from `e2e/fixtures.ts`; `findLatestBuild`/`parseElectronApp` from `electron-playwright-helpers`. Requires `apps/desktop/dist` produced by `electron-builder --dir`.

- [ ] **Step 1: Write `packaged-smoke.spec.ts`**

```ts
import { join } from 'node:path';

import { _electron as electron, expect, test } from '@playwright/test';
import { findLatestBuild, parseElectronApp } from 'electron-playwright-helpers';

import { inheritedEnv } from './fixtures';

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
```

The second test proves the `RunAsNode` fuse: with the fuse off, `ELECTRON_RUN_AS_NODE=1` turns the binary into a Node process, no window ever appears, and the launch times out. With the fuse flipped the variable is ignored and the app boots normally.

- [ ] **Step 2: Package and run locally**

```bash
pnpm build
pnpm --filter @recompose/desktop exec electron-builder --dir
pnpm --filter @recompose/desktop run test:e2e:packaged
```

Expected: 2 passing (first run pays the packaging minute).

- [ ] **Step 3: Verify gates**

```bash
pnpm run typecheck && pnpm run lint:root
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/e2e/packaged-smoke.spec.ts
git commit -m "test(e2e): packaged-artifact smoke proves asar and fuse path

Closes #58"
```

---

### Task 6: Heap-growth leak spec (Group B)

**Files:**

- Create: `apps/desktop/e2e/leak.spec.ts`

**Interfaces:**

- Consumes: `test` and `page` from `e2e/fixtures.ts`. Uses the Chrome DevTools Protocol session Playwright exposes; heap numbers come from `Runtime.getHeapUsage` (typed by Playwright, no browser globals needed).

- [ ] **Step 1: Write `leak.spec.ts`**

```ts
import { expect } from '@playwright/test';

import { test } from './fixtures';

test('navigation between screens keeps the heap bounded', { tag: '@leak' }, async ({ page }) => {
  const client = await page.context().newCDPSession(page);
  const providers = page.getByRole('link', { name: 'Providers' });
  const gateways = page.getByRole('link', { name: 'Gateways' });

  const roundTrip = async () => {
    await providers.click();
    await expect(page.getByRole('heading', { name: 'Providers' })).toBeVisible();
    await gateways.click();
    await expect(page.getByText('Select a gateway or create one to get started.')).toBeVisible();
  };

  const settledHeap = async () => {
    await client.send('HeapProfiler.collectGarbage');
    const usage = await client.send('Runtime.getHeapUsage');

    return usage.usedSize;
  };

  for (let warmup = 0; warmup < 5; warmup += 1) {
    await roundTrip();
  }
  const baseline = await settledHeap();

  for (let round = 0; round < 20; round += 1) {
    await roundTrip();
  }
  const after = await settledHeap();

  expect(after).toBeLessThan(baseline * 1.5);
});
```

The 1.5 bound is deliberately loose: it catches monotonic per-navigation leaks (20 rounds of retained queries or listeners blow well past 50 percent) while tolerating V8 noise. Tighten only with evidence from real runs.

- [ ] **Step 2: Build and run**

```bash
pnpm build
pnpm --filter @recompose/desktop run test:e2e:leak
```

Expected: 1 passing.

- [ ] **Step 3: Verify gates and commit**

```bash
pnpm run typecheck && pnpm run lint:root
git add apps/desktop/e2e/leak.spec.ts
git commit -m "test(e2e): heap growth stays bounded across navigation"
```

---

### Task 7: CI wiring (after Group B)

**Files:**

- Modify: `.github/workflows/ci.yml` (new `e2e` + `e2e-quarantine` jobs, cache step in `check`, `ci-success` needs)

**Interfaces:**

- Consumes: scripts from Task 1; the suites from Tasks 3 to 6.
- Produces: required check `e2e` inside `ci-success`.

- [ ] **Step 1: Resolve the pinned SHA for `actions/cache`**

```bash
tag=$(gh api repos/actions/cache/releases/latest --jq .tag_name)
gh api "repos/actions/cache/git/ref/tags/$tag" --jq '.object.sha + "  # " + "'"$tag"'"'
```

Use the printed SHA with the tag as the pin comment, matching the existing pin style.

- [ ] **Step 2: Add the browser cache to `check`**

Directly before the existing `playwright install --with-deps chromium` step in the `check` job:

```yaml
- uses: actions/cache@<sha-from-step-1> # <tag>
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
```

- [ ] **Step 3: Add the `e2e` matrix job**

After the `check` job:

```yaml
e2e:
  needs: changes
  if: needs.changes.outputs.code == 'true'
  strategy:
    fail-fast: false
    matrix:
      os: [macos-latest, windows-latest, ubuntu-latest]
  runs-on: ${{ matrix.os }}
  steps:
    - uses: step-security/harden-runner@bf7454d06d71f1098171f2acdf0cd4708d7b5920 # v2.20.0
      with:
        egress-policy: audit
      if: runner.os == 'Linux'
    - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
      with:
        persist-credentials: false
    - uses: pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271 # v6
    - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
      with:
        node-version: 24
        cache: pnpm
    - run: pnpm install --frozen-lockfile --trust-lockfile
    - run: pnpm exec turbo run build
      env:
        TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
        TURBO_TEAMID: ${{ vars.TURBO_TEAMID }}
    - if: runner.os == 'Linux'
      run: xvfb-run --auto-servernum pnpm --filter @recompose/desktop run test:e2e
    - if: runner.os != 'Linux'
      run: pnpm --filter @recompose/desktop run test:e2e
    - if: runner.os == 'Linux'
      run: xvfb-run --auto-servernum pnpm --filter @recompose/desktop run test:e2e:leak
    - run: pnpm --filter @recompose/desktop exec electron-builder --dir
    - if: runner.os == 'Linux'
      run: xvfb-run --auto-servernum pnpm --filter @recompose/desktop run test:e2e:packaged
    - if: runner.os != 'Linux'
      run: pnpm --filter @recompose/desktop run test:e2e:packaged
    - if: failure()
      uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
      with:
        name: e2e-traces-${{ matrix.os }}
        path: apps/desktop/test-results
        retention-days: 3
```

harden-runner only supports Linux, hence the `if`. Verify the checkout/setup SHAs against the current file and reuse whatever it pins.

- [ ] **Step 4: Add the quarantine lane**

```yaml
e2e-quarantine:
  needs: changes
  if: needs.changes.outputs.code == 'true'
  runs-on: ubuntu-latest
  continue-on-error: true
  steps:
    - uses: step-security/harden-runner@bf7454d06d71f1098171f2acdf0cd4708d7b5920 # v2.20.0
      with:
        egress-policy: audit
    - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
      with:
        persist-credentials: false
    - uses: pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271 # v6
    - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
      with:
        node-version: 24
        cache: pnpm
    - run: pnpm install --frozen-lockfile --trust-lockfile
    - run: pnpm exec turbo run build
      env:
        TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
        TURBO_TEAMID: ${{ vars.TURBO_TEAMID }}
    - run: xvfb-run --auto-servernum pnpm --filter @recompose/desktop run test:e2e:quarantine
```

- [ ] **Step 5: Wire `ci-success`**

Add `e2e` to the `ci-success` `needs` array. Do NOT add `e2e-quarantine`.

- [ ] **Step 6: Lint the workflow**

```bash
mise exec -- actionlint .github/workflows/ci.yml
mise exec -- zizmor .github/workflows/ci.yml
```

Expected: no findings.

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: three-platform e2e matrix with quarantine lane"
```

---

### Task 8: ADR-0030 and dictionary

**Files:**

- Create: `docs/adr/0030-playwright-end-to-end.md` (via the architecture-decision-records skill)
- Modify: `cspell-words.txt` (add words the ADR needs, sorted; likely `xvfb`)

**Interfaces:**

- Consumes: everything above, plus these already-landed branch decisions to record: the two mandatory skills and the CLAUDE.md rule, `@playwright/mcp` pinned exact through `pnpm exec`, the gitleaks allowlist scoped to `generic-api-key` under `.agents/skills/`.

- [ ] **Step 1: Write the ADR** covering, as decisions with rationale:
  - playwright-bdd on the native runner (Cucumber runner rejected: loses fixtures, traces, parallelism).
  - The three-platform matrix, triggered by the maintainer's confirmation that the app ships to macOS, Windows, and Linux.
  - The `RECOMPOSE_USER_DATA_DIR` seam (path redirect, not a privilege boundary).
  - The packaged smoke's scope split against the source-mode boot proof (issue #58 wording).
  - fuite and memlab evaluated and rejected: puppeteer-launched Chrome only, cannot launch an Electron binary; the CDP heap-growth spec instead, ubuntu leg only.
  - The flaky quarantine policy verbatim: a flaking test gets `@quarantine` plus a GitHub issue naming an owner and a two-week fix-or-remove deadline; exit is twenty consecutive passing quarantine runs or deletion; the lane never joins `ci-success`.
  - Riders recorded: browser cache on `check`; skills mandate; MCP pin; gitleaks scoping.
- [ ] **Step 2: Prose gates**

```bash
mise exec -- vale docs/adr/0030-playwright-end-to-end.md
pnpm exec cspell --no-progress docs/adr/0030-playwright-end-to-end.md
```

Expected: 0 errors (fix wording or extend `cspell-words.txt` through the diff, keeping it sorted).

- [ ] **Step 3: Commit**

```bash
git add docs/adr/0030-playwright-end-to-end.md cspell-words.txt
git commit -m "docs(adr): record the playwright end-to-end decisions"
```

---

## Final verification (controller, after all tasks)

```bash
pnpm run fmt:check && pnpm exec turbo run lint typecheck build test
pnpm --filter @recompose/desktop run test:e2e
pnpm --filter @recompose/desktop exec electron-builder --dir
pnpm --filter @recompose/desktop run test:e2e:packaged
pnpm --filter @recompose/desktop run test:e2e:leak
pnpm run lint:boundaries && pnpm run lint:fsd && pnpm exec knip && pnpm run lint:dup && pnpm run lint:spell && pnpm run lint:prose
mise exec -- actionlint .github/workflows/ci.yml && mise exec -- zizmor .github/workflows/ci.yml
```

All green, then push, open the PR (body ends with the generation line; mention `Closes #58`), and run the CodeRabbit cycle per CLAUDE.md.
