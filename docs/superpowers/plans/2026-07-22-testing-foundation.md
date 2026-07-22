# Testing Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the unit/integration test harness — Vitest 4 with a node/browser project split, fast-check property testing, and a CI-enforced 90% coverage gate — proven by real behavior specs.

**Architecture:** Per-package Vitest config (Turborepo guidance) with two `projects` inside `apps/desktop`: `unit` (node environment) and `browser` (Vitest Browser Mode on real Chromium via Playwright). Coverage thresholds live once in a root `vitest.shared.ts`. The CI `check` job already runs `turbo run test`; it only gains a Chromium install step.

**Tech Stack:** vitest 4.1.10, @vitest/browser-playwright 4.1.10, @vitest/coverage-v8 4.1.10, vitest-browser-react 2.2.0, fast-check 4.9.0, @fast-check/vitest 0.4.1, playwright 1.61.1.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-22-testing-foundation-design.md`.
- All dependency versions exactly as listed above (`pnpm add -D -E`).
- Filename boundary: DOM-touching tests are `*.browser.test.tsx`; everything else is `*.test.ts`. Tests are colocated with source.
- Coverage thresholds: `lines/branches/functions/statements ≥ 90`, defined only in `vitest.shared.ts`.
- Process entry-point wiring files (`src/main/index.ts`, `src/preload/index.ts`, `src/renderer/src/main.tsx`) are excluded from coverage; consequently no logic may live in them — logic is extracted to tested modules.
- TypeScript max strictness is already on (`tsconfig.strict.json`); no `any`, no `as` casts to silence errors.
- **Never write code comments** (project rule).
- The repository owner's private alias must not appear in any artifact (gitleaks `forbidden-owner-alias` enforces file contents; keep it out of commit messages and branch names manually).
- Commit messages: Conventional Commits, terse, imperative, no AI attribution in the message body (Co-Authored-By trailer only).
- Tests follow `.claude/rules/tdd-bdd.md`: state-based assertions, behavior language, no doubles for internal collaborators.
- All commands run from the worktree root.

---

### Task 1: Unit project + window-options extraction (node environment, fast-check)

**Files:**

- Modify: `apps/desktop/package.json` (devDependencies, `test` script)
- Create: `apps/desktop/vitest.config.ts`
- Modify: `apps/desktop/tsconfig.node.json` (include)
- Create: `apps/desktop/src/main/window-options.ts`
- Test: `apps/desktop/src/main/window-options.test.ts`
- Modify: `apps/desktop/src/main/index.ts`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `windowOptionsFor(platform: NodeJS.Platform, preloadPath: string, iconPath: string): BrowserWindowConstructorOptions` in `apps/desktop/src/main/window-options.ts`; `apps/desktop/vitest.config.ts` with a `unit` project that Task 2 extends with a `browser` project; `test` script that Task 3 extends with `--coverage`.

- [ ] **Step 1: Install unit-layer dependencies and add the test script**

```bash
pnpm --filter @recompose/desktop add -D -E vitest@4.1.10 fast-check@4.9.0 @fast-check/vitest@0.4.1
```

In `apps/desktop/package.json` add to `"scripts"` (after `"lint"`):

```json
    "test": "vitest run",
```

- [ ] **Step 2: Create the Vitest config with the unit project**

Create `apps/desktop/vitest.config.ts`:

```ts
import { defaultExclude, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: [...defaultExclude, '**/*.browser.test.*'],
        },
      },
    ],
  },
});
```

- [ ] **Step 3: Make the config typecheckable**

In `apps/desktop/tsconfig.node.json`, extend `include`:

```json
  "include": ["electron.vite.config.*", "vitest.config.*", "src/main/**/*", "src/preload/**/*"],
```

Run: `pnpm --filter @recompose/desktop run typecheck`
Expected: PASS (vitest.config.ts compiles; nothing else changed yet).

- [ ] **Step 4: Write the failing behavior specs (examples + property)**

Create `apps/desktop/src/main/window-options.test.ts`:

```ts
import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { windowOptionsFor } from './window-options';

const somePreload = '/app/preload/index.js';
const someIcon = '/app/resources/icon.png';

describe('window chrome per platform', () => {
  test('macOS gets transparent glass chrome with inset traffic lights', () => {
    const options = windowOptionsFor('darwin', somePreload, someIcon);

    expect(options.transparent).toBe(true);
    expect(options.titleBarStyle).toBe('hiddenInset');
    expect(options.icon).toBeUndefined();
  });

  test('Linux gets the app icon and default chrome', () => {
    const options = windowOptionsFor('linux', somePreload, someIcon);

    expect(options.icon).toBe(someIcon);
    expect(options.transparent).toBeUndefined();
    expect(options.titleBarStyle).toBeUndefined();
  });

  test('Windows gets default chrome without an icon override', () => {
    const options = windowOptionsFor('win32', somePreload, someIcon);

    expect(options.transparent).toBeUndefined();
    expect(options.titleBarStyle).toBeUndefined();
    expect(options.icon).toBeUndefined();
  });

  const anyPlatform = fc.constantFrom<NodeJS.Platform>(
    'aix',
    'android',
    'cygwin',
    'darwin',
    'freebsd',
    'haiku',
    'linux',
    'netbsd',
    'openbsd',
    'sunos',
    'win32',
  );

  test.prop([anyPlatform])(
    'every platform gets the same hidden-until-ready frame wired to the preload',
    (platform) => {
      const options = windowOptionsFor(platform, somePreload, someIcon);

      expect(options.width).toBe(900);
      expect(options.height).toBe(670);
      expect(options.show).toBe(false);
      expect(options.autoHideMenuBar).toBe(true);
      expect(options.webPreferences?.preload).toBe(somePreload);
      expect(options.webPreferences?.sandbox).toBe(false);
    },
  );
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `pnpm --filter @recompose/desktop run test`
Expected: FAIL — `Cannot find module './window-options'` (or equivalent resolve error) for all four specs.

- [ ] **Step 6: Implement the extraction**

Create `apps/desktop/src/main/window-options.ts`:

```ts
import type { BrowserWindowConstructorOptions } from 'electron';

export function windowOptionsFor(
  platform: NodeJS.Platform,
  preloadPath: string,
  iconPath: string,
): BrowserWindowConstructorOptions {
  return {
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(platform === 'darwin'
      ? {
          transparent: true,
          titleBarStyle: 'hiddenInset' as const,
        }
      : {}),
    ...(platform === 'linux' ? { icon: iconPath } : {}),
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
    },
  };
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm --filter @recompose/desktop run test`
Expected: PASS — 4 passed (the property spec runs 100 generated cases internally).

- [ ] **Step 8: Point the entry wiring at the extraction**

In `apps/desktop/src/main/index.ts`, add the import (after the `icon` import):

```ts
import { windowOptionsFor } from './window-options';
```

and replace the whole `const mainWindow = new BrowserWindow({ ... });` object literal (currently lines 17–33) with:

```ts
const mainWindow = new BrowserWindow(
  windowOptionsFor(process.platform, join(__dirname, '../preload/index.js'), icon),
);
```

Nothing else in the file changes (`isMac`, `applyGlassBackdrop`, handlers stay as they are).

- [ ] **Step 9: Verify typecheck, tests, and build still pass**

Run: `pnpm --filter @recompose/desktop run typecheck && pnpm --filter @recompose/desktop run test && pnpm --filter @recompose/desktop run build`
Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/desktop pnpm-lock.yaml
git commit -m "test(desktop): add vitest unit project, extract window options"
```

---

### Task 2: Browser Mode project + renderer shell spec + CI Chromium

**Files:**

- Modify: `apps/desktop/package.json` (devDependencies)
- Modify: `apps/desktop/vitest.config.ts` (add `browser` project)
- Modify: `apps/desktop/tsconfig.web.json` (types)
- Test: `apps/desktop/src/renderer/src/App.browser.test.tsx`
- Modify: `.github/workflows/ci.yml` (Chromium install step in `check` job)

**Interfaces:**

- Consumes: `apps/desktop/vitest.config.ts` from Task 1 — the `projects` array with the `unit` entry.
- Produces: a `browser` project entry Task 3's coverage measures; CI capable of running Browser Mode.

- [ ] **Step 1: Install browser-layer dependencies and Chromium**

```bash
pnpm --filter @recompose/desktop add -D -E @vitest/browser-playwright@4.1.10 vitest-browser-react@2.2.0 playwright@1.61.1
pnpm --filter @recompose/desktop exec playwright install chromium
```

- [ ] **Step 2: Add the browser project to the Vitest config**

Replace the whole `apps/desktop/vitest.config.ts` with:

```ts
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defaultExclude, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: [...defaultExclude, '**/*.browser.test.*'],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'browser',
          include: ['src/renderer/**/*.browser.test.tsx'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
```

- [ ] **Step 3: Add browser matcher types to the web tsconfig**

In `apps/desktop/tsconfig.web.json`, add to `compilerOptions`:

```json
    "types": ["@vitest/browser-playwright"],
```

- [ ] **Step 4: Write the renderer shell spec**

Create `apps/desktop/src/renderer/src/App.browser.test.tsx`:

```tsx
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import App from './App';

test('the shell presents a sidebar beside the main area', async () => {
  const screen = render(<App />);

  await expect.element(screen.getByText('Sidebar')).toBeVisible();
  await expect.element(screen.getByText('Main Area')).toBeVisible();
});
```

- [ ] **Step 5: Run and verify it passes in real Chromium**

Run: `pnpm --filter @recompose/desktop run test`
Expected: PASS — unit project 4 passed, browser project 1 passed (look for `chromium` in the browser project banner).

- [ ] **Step 6: Prove the browser harness actually asserts**

Temporarily change `screen.getByText('Sidebar')` to `screen.getByText('No Such Text')`, run `pnpm --filter @recompose/desktop run test`, and confirm the browser project FAILS with an element-not-found error. Revert the change and re-run to confirm PASS again.

- [ ] **Step 7: Verify typecheck**

Run: `pnpm --filter @recompose/desktop run typecheck`
Expected: PASS (`expect.element` and `render` resolve their types).

- [ ] **Step 8: Commit the harness**

```bash
git add apps/desktop pnpm-lock.yaml
git commit -m "test(desktop): browser-mode project for renderer DOM specs"
```

- [ ] **Step 9: Teach CI to install Chromium**

In `.github/workflows/ci.yml`, in the `check` job, insert between `- run: pnpm install --frozen-lockfile` and `- run: pnpm run fmt:check`:

```yaml
- run: pnpm --filter @recompose/desktop exec playwright install --with-deps chromium
```

- [ ] **Step 10: Commit the CI change**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: install chromium for browser-mode tests"
```

---

### Task 3: Coverage gate (shared thresholds, turbo wiring)

**Files:**

- Modify: `apps/desktop/package.json` (devDependencies, `test` script)
- Create: `vitest.shared.ts` (repo root)
- Modify: `apps/desktop/vitest.config.ts` (coverage block)
- Modify: `apps/desktop/tsconfig.node.json` (include the shared file)
- Modify: `apps/desktop/.gitignore` (`coverage`)
- Modify: `turbo.json` (`test` task inputs/outputs)

**Interfaces:**

- Consumes: the full `projects` config from Task 2.
- Produces: `coverageDefaults` (provider, reporters, thresholds) exported from `vitest.shared.ts` — the single place thresholds live; every future package spreads it.

- [ ] **Step 1: Install the coverage provider**

```bash
pnpm --filter @recompose/desktop add -D -E @vitest/coverage-v8@4.1.10
```

- [ ] **Step 2: Create the shared coverage contract**

Create `vitest.shared.ts` at the repo root:

```ts
export const coverageDefaults = {
  provider: 'v8',
  reporter: ['text', 'lcov'],
  thresholds: {
    lines: 90,
    branches: 90,
    functions: 90,
    statements: 90,
  },
} as const;
```

- [ ] **Step 3: Wire coverage into the desktop config**

In `apps/desktop/vitest.config.ts`, add the import:

```ts
import { coverageDefaults } from '../../vitest.shared';
```

and add a `coverage` block inside `test` (before `projects`):

```ts
    coverage: {
      ...coverageDefaults,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.*',
        'src/**/*.browser.test.*',
        'src/**/*.d.ts',
        'src/main/index.ts',
        'src/preload/index.ts',
        'src/renderer/src/main.tsx',
      ],
    },
```

The three excluded source files are process entry points: pure composition wiring at the Electron boundary. The rule this encodes: logic never lives in an entry file — it gets extracted (as `window-options.ts` was) and tested.

In `apps/desktop/tsconfig.node.json`, extend `include`:

```json
  "include": [
    "electron.vite.config.*",
    "vitest.config.*",
    "../../vitest.shared.ts",
    "src/main/**/*",
    "src/preload/**/*"
  ],
```

- [ ] **Step 4: Make every test run enforce the gate**

In `apps/desktop/package.json` change the `test` script to:

```json
    "test": "vitest run --coverage",
```

Append `coverage` on its own line to `apps/desktop/.gitignore`.

- [ ] **Step 5: Run and verify the gate passes**

Run: `pnpm --filter @recompose/desktop run test`
Expected: PASS, with a coverage table showing `window-options.ts` and `App.tsx` at 100% and no threshold errors.

- [ ] **Step 6: Prove the gate fails when thresholds are not met**

Run: `pnpm --filter @recompose/desktop exec vitest run --coverage --coverage.thresholds.lines=101`
Expected: exit code 1 with a `coverage threshold` error. Verify with `echo $?` (bash) — must print `1`.

- [ ] **Step 7: Wire turbo caching**

In `turbo.json`, replace `"test": {}` with:

```json
    "test": {
      "inputs": ["$TURBO_DEFAULT$", "$TURBO_ROOT$/vitest.shared.ts"],
      "outputs": ["coverage/**"]
    }
```

- [ ] **Step 8: Verify the root pipeline**

Run: `pnpm test`
Expected: turbo runs `@recompose/desktop:test`, PASS. Run `pnpm test` again — expected `FULL TURBO` (cache hit).

Run: `pnpm --filter @recompose/desktop run typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/desktop turbo.json vitest.shared.ts pnpm-lock.yaml
git commit -m "test: enforce 90% coverage gate via shared thresholds"
```

---

### Task 4: ADR-0012

**Files:**

- Create: `docs/adr/0012-vitest-testing-foundation.md`
- Modify: `docs/adr/README.md` (index row)

**Interfaces:**

- Consumes: the shipped harness from Tasks 1–3 (referenced, not changed).
- Produces: the decision record; nothing downstream.

- [ ] **Step 1: Write the ADR**

Create `docs/adr/0012-vitest-testing-foundation.md`:

```markdown
# ADR-0012: Vitest Testing Foundation with Browser Mode and Property Testing

**Status**: Accepted
**Date**: 2026-07-22

## Context

The infrastructure queue reached the unit/integration layers of the test pyramid. The repo had a turbo `test` task with no runner behind it. Prior commitments bind the choice: tests are colocated, TDD is mandatory (`.claude/rules/tdd-bdd.md`), the renderer is a node-based canvas UI where simulated-DOM fidelity is weakest, and the CI `check` job already runs `turbo run test`.

## Decision

- **Vitest 4** as the runner, configured per package with a `projects` split inside `apps/desktop`: `unit` (node environment — main, preload, renderer pure logic) and `browser` (Browser Mode on real Chromium via `@vitest/browser-playwright`, rendering with `vitest-browser-react`). No jsdom/happy-dom anywhere; the filename decides the environment (`*.browser.test.tsx` vs `*.test.ts`).
- **fast-check v4 via `@fast-check/vitest`** for property-based testing, colocated in the same spec files (`test.prop`). Core domain logic gets example and property specs.
- **Coverage gate**: `@vitest/coverage-v8` with `lines/branches/functions/statements ≥ 90`, thresholds defined once in the root `vitest.shared.ts`. `coverage.include` spans all of `src/`, so an untested (or misnamed) file counts against the gate. Process entry files (`src/main/index.ts`, `src/preload/index.ts`, `src/renderer/src/main.tsx`) are excluded as pure composition wiring — the corollary rule is that logic never lives in them.
- **Turbo wiring**: per-package `test` script (Turborepo guidance over root-level projects), `coverage/**` cached as task output. CI gains one step: `playwright install --with-deps chromium`.

## Alternatives

- **jsdom/happy-dom for renderer tests**: faster and dependency-free, but a simulation — weakest exactly where this app lives (canvas layout, pointer interaction, real CSS). Rejected for fidelity; Browser Mode is stable in Vitest 4.
- **Root-level Vitest projects for the whole monorepo**: single command and merged coverage, but defeats turbo's per-package caching; Turborepo documents it as the compatibility path, not the recommended one.
- **Coverage as report-only**: no machine pressure; rejected — prose-only rules drift (ADR-0011's lesson), and TDD makes the threshold cheap to hold.

## Consequences

**Good**: environments are chosen by filename, not judgment; DOM specs run where the app actually runs (Chromium); property tests share the runner and reporter; the coverage gate turns "every layer is tested" from prose into an exit code; unchanged packages skip their test task entirely via turbo cache.

**Bad**: Browser Mode needs a Chromium download locally and in CI (one install step, ~30s uncached); coverage thresholds are repo-global — a future package with a legitimate reason for lower coverage has to argue with the shared file; entry-file exclusion relies on the extraction discipline the plan establishes.
```

- [ ] **Step 2: Add the index row**

In `docs/adr/README.md`, append after the 0011 row (or after 0009 if 0011 is not yet on this branch):

```markdown
| [0012](0012-vitest-testing-foundation.md) | Vitest Testing Foundation with Browser Mode and Property Testing | Accepted | 2026-07-22 |
```

- [ ] **Step 3: Commit**

```bash
git add docs/adr
git commit -m "docs(adr): record testing foundation (ADR-0012)"
```
