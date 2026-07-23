# Dependency Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Machine-enforce the dependency rules the folder-structure spec wrote as target state — dependency-cruiser over one whole-repo import graph, Steiger over the FSD renderer — wired into pre-commit and CI.

**Architecture:** Both tools are root-level gates (like `fmt:check`), not turbo tasks: cross-package rules need the full graph and both run in under a second. Rules for unopened packages (`packages/engine`, `packages/contracts`, `apps/headless`) ship now and bind when those paths appear.

**Tech Stack:** dependency-cruiser 18.1.0, steiger 0.6.0, @feature-sliced/steiger-plugin 0.7.0.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-23-dependency-boundaries-design.md`.
- Dependency versions exactly as listed above, installed at the repo root with `pnpm add -D -E -w`.
- All dependency-cruiser rules `severity: 'error'`; Steiger runs with `--fail-on-warnings`.
- The current tree must pass both tools without any rule disables. If a legitimate file trips a recommended rule, STOP and report BLOCKED — never disable a rule to get green.
- Every rule class is proven both ways: a temporary violating file makes the tool exit 1, and the clean tree exits 0. No permanent fixture files are committed; every proof file is deleted before any commit.
- **Never write code comments** (project rule; applies to `.dependency-cruiser.cjs` and `steiger.config.ts` too).
- TypeScript max strictness; no `any`, no `as` casts to silence errors.
- The repository owner's private alias must not appear in any artifact.
- Commit messages: Conventional Commits, terse, imperative; end with trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- A pre-commit hook runs gitleaks/lint/fmt/typecheck; oxfmt may reformat and auto-stage files (expected). If the FIRST commit attempt in a fresh worktree fails with `./node_modules/.bin/oxfmt: No such file or directory`, run `pnpm install` once and retry the commit.
- All commands run from the worktree root.

---

### Task 1: dependency-cruiser — whole-repo boundary rules

**Files:**

- Modify: `package.json` (root devDependencies, `lint:boundaries` script)
- Create: `.dependency-cruiser.cjs`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: root script `lint:boundaries` (exit 0 clean / exit 1 on violation) that Task 3 wires into lefthook and CI.

- [ ] **Step 1: Install and add the script**

```bash
pnpm add -D -E -w dependency-cruiser@18.1.0
```

In the root `package.json` `"scripts"`, after `"lint:fix"`:

```json
    "lint:boundaries": "depcruise apps",
```

- [ ] **Step 2: Create the config**

Create `.dependency-cruiser.cjs`:

```js
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'renderer-isolated',
      severity: 'error',
      from: { path: '^apps/desktop/src/renderer' },
      to: {
        path: '^apps/desktop/src/(main|preload)',
        pathNot: '^apps/desktop/src/preload/index\\.d\\.ts$',
      },
    },
    {
      name: 'main-not-into-renderer',
      severity: 'error',
      from: { path: '^apps/desktop/src/main' },
      to: { path: '^apps/desktop/src/renderer' },
    },
    {
      name: 'preload-isolated',
      severity: 'error',
      from: { path: '^apps/desktop/src/preload' },
      to: { path: '^apps/desktop/src/(main|renderer)' },
    },
    {
      name: 'engine-no-electron',
      severity: 'error',
      from: { path: '^packages/engine' },
      to: { path: 'node_modules/electron/' },
    },
    {
      name: 'engine-only-contracts',
      severity: 'error',
      from: { path: '^packages/engine' },
      to: {
        path: '^(apps|packages)/',
        pathNot: '^packages/(engine|contracts)/',
      },
    },
    {
      name: 'desktop-not-into-engine',
      severity: 'error',
      from: { path: '^apps/desktop' },
      to: { path: '^packages/engine' },
    },
    {
      name: 'headless-scope',
      severity: 'error',
      from: { path: '^apps/headless' },
      to: {
        path: '^(apps|packages)/',
        pathNot: '^(apps/headless|packages/(engine|contracts))/',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'apps/desktop/tsconfig.web.json' },
  },
};
```

- [ ] **Step 3: Negative proof — the clean tree passes**

Run: `pnpm run lint:boundaries`
Expected: exit 0, output ends with `no dependency violations found` (module/dependency counts may vary).
Verify the exit code explicitly: `pnpm run lint:boundaries; echo "exit: $?"` (bash) — must print `exit: 0`.

- [ ] **Step 4: Positive proof — process isolation fires**

```bash
printf "import '../../main/windows/window-options';\n" > apps/desktop/src/renderer/src/violation-probe.ts
pnpm run lint:boundaries; echo "exit: $?"
```

Expected: `renderer-isolated` violation reported, `exit: 1`.

```bash
rm apps/desktop/src/renderer/src/violation-probe.ts
```

- [ ] **Step 5: Positive proof — circular fires**

```bash
printf "import './probe-b';\nexport const a = 1;\n" > apps/desktop/src/main/probe-a.ts
printf "import './probe-a';\nexport const b = 1;\n" > apps/desktop/src/main/probe-b.ts
pnpm run lint:boundaries; echo "exit: $?"
```

Expected: `no-circular` violation reported, `exit: 1`.

```bash
rm apps/desktop/src/main/probe-a.ts apps/desktop/src/main/probe-b.ts
```

- [ ] **Step 6: Positive proof — pre-staged engine rules fire**

```bash
mkdir -p packages/engine/src
printf "import 'electron';\nimport '../../../apps/desktop/src/main/windows/window-options';\n" > packages/engine/src/probe.ts
pnpm exec depcruise apps packages; echo "exit: $?"
```

Expected: `engine-no-electron` AND `engine-only-contracts` violations reported, `exit: 1`. (The proof run passes `packages` explicitly; the committed script gains that argument only when the directory opens for real.)

```bash
rm -rf packages
```

- [ ] **Step 7: Re-run the negative proof after cleanup**

Run: `pnpm run lint:boundaries; echo "exit: $?"`
Expected: `exit: 0`. Also `git status --short` shows only `package.json`, `pnpm-lock.yaml`, and `.dependency-cruiser.cjs` — no probe files remain.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml .dependency-cruiser.cjs
git commit -m "ci: enforce dependency boundaries with dependency-cruiser"
```

---

### Task 2: Steiger — FSD rules over the renderer

**Files:**

- Modify: `package.json` (root devDependencies, `lint:fsd` script)
- Create: `steiger.config.ts`
- Modify: `apps/desktop/tsconfig.node.json` (include)

**Interfaces:**

- Consumes: nothing from Task 1.
- Produces: root script `lint:fsd` (exit 0 clean / exit 1 on violation or warning) that Task 3 wires into lefthook and CI.

- [ ] **Step 1: Install and add the script**

```bash
pnpm add -D -E -w steiger@0.6.0 @feature-sliced/steiger-plugin@0.7.0
```

In the root `package.json` `"scripts"`, after `"lint:boundaries"`:

```json
    "lint:fsd": "steiger apps/desktop/src/renderer/src --fail-on-warnings",
```

- [ ] **Step 2: Create the config**

Create `steiger.config.ts`:

```ts
import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([...fsd.configs.recommended]);
```

- [ ] **Step 3: Make the config typecheckable**

In `apps/desktop/tsconfig.node.json`, extend `include` (it already lists `../../vitest.shared.ts`):

```json
  "include": [
    "electron.vite.config.*",
    "vitest.config.*",
    "../../vitest.shared.ts",
    "../../steiger.config.ts",
    "src/main/**/*",
    "src/preload/**/*"
  ],
```

Run: `pnpm --filter @recompose/desktop run typecheck`
Expected: PASS.

- [ ] **Step 4: Negative proof — the clean renderer passes**

Run: `pnpm run lint:fsd; echo "exit: $?"`
Expected: `exit: 0` with no diagnostics. If the current tree (a lone `app/` layer with `app.tsx`, `main.tsx`, `styles/`, colocated tests) produces ANY diagnostic, STOP — report BLOCKED with the diagnostic text; do not disable rules.

- [ ] **Step 5: Positive proof — FSD layer rule fires**

```bash
mkdir -p apps/desktop/src/renderer/src/entities/gateway/model
printf "import '../../../app/app';\nexport const gateway = 1;\n" > apps/desktop/src/renderer/src/entities/gateway/model/gateway.ts
pnpm run lint:fsd; echo "exit: $?"
```

Expected: `exit: 1` — at minimum `fsd/no-higher-level-imports` fires (an entity importing from the app layer); missing-public-api diagnostics may accompany it.

```bash
rm -rf apps/desktop/src/renderer/src/entities
pnpm run lint:fsd; echo "exit: $?"
```

Expected: `exit: 0` again, and `git status --short` shows only `package.json`, `pnpm-lock.yaml`, `steiger.config.ts`, and `apps/desktop/tsconfig.node.json`.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml steiger.config.ts apps/desktop/tsconfig.node.json
git commit -m "ci: enforce fsd renderer rules with steiger"
```

---

### Task 3: Wire both gates into pre-commit and CI

**Files:**

- Modify: `lefthook.yml` (two pre-commit jobs)
- Modify: `.github/workflows/ci.yml` (one step in the `check` job)

**Interfaces:**

- Consumes: root scripts `lint:boundaries` (Task 1) and `lint:fsd` (Task 2).
- Produces: the enforced gates; nothing downstream.

- [ ] **Step 1: Add the lefthook jobs**

In `lefthook.yml`, inside `pre-commit.jobs`, after the existing `lint` job (keep every existing job untouched):

```yaml
- name: boundaries
  priority: 1
  run: pnpm run lint:boundaries
- name: fsd
  priority: 1
  run: pnpm run lint:fsd
```

- [ ] **Step 2: Add the CI step**

In `.github/workflows/ci.yml`, in the `check` job, after the `- run: pnpm exec turbo run lint typecheck build test` step:

```yaml
- run: pnpm run lint:boundaries && pnpm run lint:fsd
```

- [ ] **Step 3: Prove the hook blocks a violating commit**

```bash
printf "import '../../main/windows/window-options';\n" > apps/desktop/src/renderer/src/violation-probe.ts
git add apps/desktop/src/renderer/src/violation-probe.ts lefthook.yml
git commit -m "test: probe" ; echo "exit: $?"
```

Expected: commit REFUSED (`exit: 1`), lefthook output shows the `boundaries` job failing with `renderer-isolated`.

```bash
git reset HEAD apps/desktop/src/renderer/src/violation-probe.ts
rm apps/desktop/src/renderer/src/violation-probe.ts
```

- [ ] **Step 4: Commit the wiring**

```bash
git add lefthook.yml .github/workflows/ci.yml
git commit -m "ci: run boundary and fsd gates in pre-commit and check job"
```

Expected: this commit itself passes the two new hooks (they run on it).

---

### Task 4: ADR-0014

**Files:**

- Create: `docs/adr/0014-dependency-boundaries-enforcement.md`
- Modify: `docs/adr/README.md` (index row after 0013)

**Interfaces:**

- Consumes: the shipped gates from Tasks 1–3 (referenced, not changed).
- Produces: the decision record; nothing downstream.

- [ ] **Step 1: Write the ADR**

Create `docs/adr/0014-dependency-boundaries-enforcement.md`:

```markdown
# ADR-0014: Dependency Boundaries Enforced by dependency-cruiser and Steiger

**Status**: Accepted
**Date**: 2026-07-23

## Context

ADR-0010 chose the tools and the folder-structure spec wrote the dependency rules — Electron process isolation, the engine/contracts/desktop package directions, no circular imports, FSD layer discipline in the renderer — but only as prose ("target state"). ADR-0011's lesson applies: prose rules drift; machine-checked rules do not.

## Decision

- **One whole-repo import graph at the root.** `.dependency-cruiser.cjs` and `steiger.config.ts` live at the repo root; `lint:boundaries` (`depcruise apps`) and `lint:fsd` (`steiger … --fail-on-warnings`) are root scripts in the same gate layer as `fmt:check`, not turbo tasks — cross-package rules need the full graph, and both tools finish in under a second.
- **Eight dependency-cruiser rules, all `error`**: `no-circular`, three Electron process-isolation rules (renderer/main/preload cannot import across process lines; the preload type declarations are the one exception), and four pre-staged package rules (`engine-no-electron`, `engine-only-contracts`, `desktop-not-into-engine`, `headless-scope`) written against paths that do not exist yet — they bind the day a package opens. The single follow-up when `packages/` opens: add `packages` to the scan arguments (`depcruise apps packages`); depcruise errors on nonexistent paths, and `includeOnly` was rejected because it filters node_modules edges out of the graph, silently disabling `engine-no-electron`.
- **Steiger with `fsd.configs.recommended` and `--fail-on-warnings`** over `apps/desktop/src/renderer/src` — warnings fail too; a rule disable requires a config entry, which review sees.
- **Stages: pre-commit + CI** (ADR-0006/0007 layering) — two lefthook jobs plus one CI `check`-job step running the same scripts.

## Alternatives

- **Per-package turbo tasks**: fits turbo's caching model but splits the one graph cross-package rules need; sub-second tools gain nothing from caching.
- **eslint-plugin-boundaries**: needs an ESLint toolchain the repo deliberately does not have (oxlint ecosystem, ADR-0010).
- **CI-only**: catches violations after they are public; the local hook stops them at commit time, CI remains the net for `--no-verify`.

## Consequences

**Good**: every dependency rule from the folder-structure spec is now an exit code; violations cannot be committed locally or merged remotely; the engine's purity rules exist before the engine does, so its first line of code is already fenced.

**Bad**: two more pre-commit seconds; the scan-argument change when `packages/` opens is a manual step this ADR must be trusted to surface; Steiger cannot take custom rules yet, so renderer rules are capped at the FSD recommended set.
```

- [ ] **Step 2: Add the index row**

In `docs/adr/README.md`, append after the 0013 row:

```markdown
| [0014](0014-dependency-boundaries-enforcement.md) | Dependency Boundaries Enforced by dependency-cruiser and Steiger | Accepted | 2026-07-23 |
```

- [ ] **Step 3: Commit**

```bash
git add docs/adr
git commit -m "docs(adr): record dependency boundary enforcement (ADR-0014)"
```
