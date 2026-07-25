# Stryker Mutation Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A blocking, diff-scoped Stryker mutation gate on pull requests over the node-tested surfaces, plus a weekly non-blocking full run that refreshes the incremental baseline and feeds the Stryker dashboard.

**Architecture:** Each package gets a dedicated single-project mutation Vitest config (no typecheck, no coverage) and a Stryker config bound to it with `coverageAnalysis: perTest` and incremental mode. A `mutation` job in `ci.yml` computes changed files against the PR base, skips cleanly when the diff misses the mutate scope, and otherwise gates on `thresholds.break`. `mutation-full.yml` runs everything weekly, uploads the HTML report, refreshes the incremental cache, and reports to the dashboard.

**Tech Stack:** @stryker-mutator/core 9.6.1, @stryker-mutator/vitest-runner 9.6.1, Vitest (existing), actions/cache, dashboard.stryker-mutator.io.

**Spec:** `docs/superpowers/specs/2026-07-26-stryker-mutation-design.md`

## Global Constraints

- Never commit to `main`; branch `worktree-stryker`; one PR closes the job.
- The forbidden owner alias (the word the gitleaks `forbidden-owner-alias` rule bans) must never appear in any artifact.
- devDependencies pin exact: `@stryker-mutator/core@9.6.1`, `@stryker-mutator/vitest-runner@9.6.1`.
- Mutate scope mirrors the coverage scope: `packages/contracts/src` minus tests, and `apps/desktop/src/main` minus tests and minus the exact files the desktop coverage config already excludes (`src/main/index.ts`, `src/main/ipc/register-ipc.ts`, `src/main/protocol/app-protocol.ts`, `src/main/windows/main-window.ts`).
- The PR gate BLOCKS via `thresholds.break` and joins `ci-success.needs`; the weekly run NEVER blocks.
- The dashboard reporter runs ONLY in the weekly workflow (`STRYKER_DASHBOARD_API_KEY` secret already exists); project `github.com/recomposesh/recompose`, version `main`, modules `contracts` and `desktop-main`.
- `stryker-incremental.json` files are CI cache artifacts, never committed.
- Break floors are MEASURED: floor = measured full-run mutation score per package, rounded down, minus 5 points. Record both scores and floors in the Task 1 report; the ADR carries them as evidence.
- Workflow actions SHA-pinned with version comments, copied from `ci.yml`. No code comments. Commits caveman + trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- ADR/docs pass Vale + cspell; plans exempt. If cspell flags Stryker vocabulary (`stryker`, `mutator`), add the words to `cspell-words.txt` case-insensitively sorted.

## File structure

| File                                                            | Responsibility                                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `packages/contracts/vitest.mutation.config.ts`                  | Node-only test run for mutants: no typecheck, no coverage                             |
| `packages/contracts/stryker.config.json`                        | Contracts mutation scope, thresholds, incremental, dashboard module `contracts`       |
| `apps/desktop/vitest.mutation.config.ts`                        | The `unit` project flattened to a single config: node env, browser tests excluded     |
| `apps/desktop/stryker.config.json`                              | Main-process mutation scope, thresholds, incremental, dashboard module `desktop-main` |
| both `package.json`s                                            | `test:mutation` script + exact-pinned devDeps                                         |
| `.gitignore`                                                    | `.stryker-tmp/` and `reports/`                                                        |
| `.github/workflows/ci.yml`                                      | `mutation` job + `ci-success.needs` entry                                             |
| `.github/workflows/mutation-full.yml`                           | Weekly full run: report artifact, cache refresh, dashboard                            |
| `docs/adr/0036-stryker-mutation-gate.md` + `docs/adr/README.md` | Decision record + index row                                                           |

**Sequencing:** Task 1 first (it produces the measured floors and script names). Tasks 2, 3, 4 then run in any order. Task 5 last.

---

### Task 1: Mutation configs, deps, and the measured floors

**Files:**

- Create: `packages/contracts/vitest.mutation.config.ts`, `packages/contracts/stryker.config.json`
- Create: `apps/desktop/vitest.mutation.config.ts`, `apps/desktop/stryker.config.json`
- Modify: `packages/contracts/package.json`, `apps/desktop/package.json` (devDeps + script)
- Modify: `.gitignore`

**Interfaces:**

- Produces: `pnpm --filter @recompose/contracts run test:mutation` and `pnpm --filter @recompose/desktop run test:mutation` (full runs, exit non-zero below break); the same commands accept extra Stryker flags after `--` (Tasks 2–3 pass `--incremental` variants and `--mutate` lists). Measured scores + final `break` values in the report for Task 4's ADR.

- [ ] **Step 1: Add the dependencies**

```bash
pnpm add -D -E @stryker-mutator/core@9.6.1 @stryker-mutator/vitest-runner@9.6.1 --filter @recompose/contracts --filter @recompose/desktop
```

- [ ] **Step 2: Contracts mutation Vitest config**

`packages/contracts/vitest.mutation.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Contracts Stryker config**

`packages/contracts/stryker.config.json` (break starts at 0; Step 8 replaces it with the measured floor):

```json
{
  "$schema": "https://raw.githubusercontent.com/stryker-mutator/stryker-js/master/packages/api/schema/stryker-core.json",
  "testRunner": "vitest",
  "vitest": { "configFile": "vitest.mutation.config.ts" },
  "mutate": ["src/**/*.ts", "!src/**/*.test.ts", "!src/**/*.test-d.ts"],
  "coverageAnalysis": "perTest",
  "incremental": true,
  "incrementalFile": "reports/stryker-incremental.json",
  "reporters": ["html", "clear-text", "progress"],
  "htmlReporter": { "fileName": "reports/mutation/mutation.html" },
  "thresholds": { "high": 90, "low": 70, "break": 0 },
  "dashboard": {
    "project": "github.com/recomposesh/recompose",
    "version": "main",
    "module": "contracts"
  }
}
```

- [ ] **Step 4: Desktop mutation Vitest config**

`apps/desktop/vitest.mutation.config.ts` (the `unit` project flattened; browser and storybook stay out):

```ts
import { defaultExclude, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: [...defaultExclude, '**/*.browser.test.*'],
  },
});
```

(If `defaultExclude` imports differently in the installed Vitest, copy the exclude expression exactly as `apps/desktop/vitest.config.ts` line ~35 does it and record the difference.)

- [ ] **Step 5: Desktop Stryker config**

`apps/desktop/stryker.config.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/stryker-mutator/stryker-js/master/packages/api/schema/stryker-core.json",
  "testRunner": "vitest",
  "vitest": { "configFile": "vitest.mutation.config.ts" },
  "mutate": [
    "src/main/**/*.ts",
    "!src/main/**/*.test.ts",
    "!src/main/index.ts",
    "!src/main/ipc/register-ipc.ts",
    "!src/main/protocol/app-protocol.ts",
    "!src/main/windows/main-window.ts"
  ],
  "coverageAnalysis": "perTest",
  "incremental": true,
  "incrementalFile": "reports/stryker-incremental.json",
  "reporters": ["html", "clear-text", "progress"],
  "htmlReporter": { "fileName": "reports/mutation/mutation.html" },
  "thresholds": { "high": 90, "low": 70, "break": 0 },
  "dashboard": {
    "project": "github.com/recomposesh/recompose",
    "version": "main",
    "module": "desktop-main"
  }
}
```

- [ ] **Step 6: Scripts and gitignore**

Both `package.json` script blocks gain:

```json
"test:mutation": "stryker run",
```

Root `.gitignore` gains two lines (keep existing entries untouched):

```text
.stryker-tmp/
reports/
```

- [ ] **Step 7: Measure both full runs**

```bash
pnpm --filter @recompose/contracts run test:mutation
pnpm --filter @recompose/desktop run test:mutation
```

Expected: both complete (minutes, not hours — the suites run in under two seconds). Record from each clear-text summary: the mutation score, mutant counts (killed/survived/no-coverage), and wall time. If either errors on config shape (project/typecheck friction), fix the mutation Vitest config minimally and record what changed and why.

- [ ] **Step 8: Set the measured floors**

In each `stryker.config.json`, replace `"break": 0` with the package's measured score rounded down minus 5 (example: score 83.4 → break 78). Re-run each `test:mutation` once to prove the gate passes at the new floor.

- [ ] **Step 9: Commit**

```bash
git add packages/contracts/vitest.mutation.config.ts packages/contracts/stryker.config.json apps/desktop/vitest.mutation.config.ts apps/desktop/stryker.config.json packages/contracts/package.json apps/desktop/package.json .gitignore pnpm-lock.yaml
git commit -m "test: stryker mutation configs with measured floors

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: The PR mutation job

**Files:**

- Modify: `.github/workflows/ci.yml` (new `mutation` job + one line in `ci-success.needs`)

**Interfaces:**

- Consumes: `test:mutation` scripts from Task 1.
- Produces: a required, diff-scoped gate.

- [ ] **Step 1: Add the job**

Insert after the `check` job (pins copied verbatim from `ci.yml`'s other jobs):

```yaml
mutation:
  needs: changes
  if: needs.changes.outputs.code == 'true' && github.event_name == 'pull_request'
  runs-on: ubuntu-latest
  steps:
    - uses: step-security/harden-runner@bf7454d06d71f1098171f2acdf0cd4708d7b5920 # v2.20.0
      with:
        egress-policy: audit
    - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
      with:
        persist-credentials: false
        fetch-depth: 0
    - uses: pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271 # v6
    - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
      with:
        node-version: 24
        cache: pnpm
    - run: pnpm install --frozen-lockfile --trust-lockfile
    - uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
      with:
        path: |
          packages/contracts/reports/stryker-incremental.json
          apps/desktop/reports/stryker-incremental.json
        key: mutation-incremental-${{ github.sha }}
        restore-keys: mutation-incremental-
    - shell: bash
      run: |
        contracts=$(git diff --name-only "$BASE_SHA"...HEAD -- 'packages/contracts/src/**/*.ts' | grep -vE '\.test(-d)?\.ts$' | sed 's|^packages/contracts/||' | paste -sd, -) || true
        desktop=$(git diff --name-only "$BASE_SHA"...HEAD -- 'apps/desktop/src/main/**/*.ts' | grep -vE '\.test\.ts$' | sed 's|^apps/desktop/||' | paste -sd, -) || true
        if [ -z "$contracts" ] && [ -z "$desktop" ]; then
          echo "mutation scope untouched, skipping"
          exit 0
        fi
        if [ -n "$contracts" ]; then
          pnpm --filter @recompose/contracts run test:mutation -- --incremental --mutate "$contracts"
        fi
        if [ -n "$desktop" ]; then
          pnpm --filter @recompose/desktop run test:mutation -- --incremental --mutate "$desktop"
        fi
      env:
        BASE_SHA: ${{ github.event.pull_request.base.sha }}
```

- [ ] **Step 2: Wire the roll-up**

Add `mutation` to the `ci-success` job's `needs` list, and mirror the existing pattern the roll-up uses for conditional jobs (inspect how `e2e` appears in `ci-success`'s `needs`/`if`/result checks and treat `mutation` identically; the job may be skipped on pushes to main, and the roll-up must accept that the same way it accepts filter-skipped jobs).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: diff-scoped mutation gate in the required lane

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: The weekly full run

**Files:**

- Create: `.github/workflows/mutation-full.yml`

**Interfaces:**

- Consumes: `test:mutation` scripts; `STRYKER_DASHBOARD_API_KEY` secret (exists).

- [ ] **Step 1: Create the workflow**

```yaml
name: mutation-full

on:
  schedule:
    - cron: '41 4 * * 1'
  workflow_dispatch:

permissions:
  contents: read

jobs:
  mutation-full:
    runs-on: ubuntu-latest
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
      - run: pnpm --filter @recompose/contracts run test:mutation -- --reporters html,clear-text,progress,dashboard
        env:
          STRYKER_DASHBOARD_API_KEY: ${{ secrets.STRYKER_DASHBOARD_API_KEY }}
      - run: pnpm --filter @recompose/desktop run test:mutation -- --reporters html,clear-text,progress,dashboard
        env:
          STRYKER_DASHBOARD_API_KEY: ${{ secrets.STRYKER_DASHBOARD_API_KEY }}
      - uses: actions/cache/save@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
        if: always()
        with:
          path: |
            packages/contracts/reports/stryker-incremental.json
            apps/desktop/reports/stryker-incremental.json
          key: mutation-incremental-${{ github.sha }}-${{ github.run_id }}
      - uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        if: always()
        with:
          name: mutation-report
          path: |
            packages/contracts/reports/mutation/
            apps/desktop/reports/mutation/
          retention-days: 30
```

Notes: the cron minute is deliberately off the hour; the job never joins any needs list and blocks nothing (its own red is the weekly signal); `workflow_dispatch` exists so the first proof run doesn't wait a week — and it makes the workflow dispatchable once registered on the default branch (learned constraint: dispatch works only after the file exists on main, so the manual proof happens post-merge).

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/mutation-full.yml
git commit -m "ci: weekly full mutation run with dashboard report

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: ADR-0036 and the index row

**Files:**

- Create: `docs/adr/0036-stryker-mutation-gate.md`
- Modify: `docs/adr/README.md` (one row after 0035)

**Interfaces:**

- Consumes: Task 1's measured scores and floors (read them from the Task 1 report; the ADR text below carries two placeholders `MEASURED_CONTRACTS` and `MEASURED_DESKTOP` plus the two floors — substitute the real numbers, they are the ONLY permitted substitutions).

- [ ] **Step 1: Write the record**

`docs/adr/0036-stryker-mutation-gate.md`, exactly (numbers substituted):

```markdown
# 0036: Stryker mutation gate over the node-tested surfaces

**Status**: Accepted
**Date**: 2026-07-26

## Context

The coverage gates prove lines run. They don't prove tests bite: a suite full of weak assertions can hold 100 percent patch coverage while catching nothing. Mutation testing supplies the teeth. StrykerJS mutates the source and counts how many mutants the tests kill. The maintainer pulled this gate forward from the engine rider after the infrastructure queue closed, keeping the rider's two constraints: diff-scoped runs per pull request plus a scheduled full run, with the full run never sitting in the delivery pipeline. The maintainer resolved the open half during the brainstorm: the pull request run blocks, the scheduled run informs.

## Decision

- **Mutation covers the node-tested surfaces only.** The mutate scope is `packages/contracts/src` and `apps/desktop/src/main`, minus tests and minus the exact entry points the coverage config already excludes. The renderer stays out: Stryker's vitest runner doesn't support browser mode, and that support arriving is the recorded revisit trigger.
- **Each package carries a dedicated mutation Vitest config.** No typecheck, no coverage, single project: mutants need the fastest honest kill loop, and the desktop config flattens the `unit` project so the browser and Storybook projects never load. `coverageAnalysis: perTest` keeps each mutant's test set minimal.
- **The pull request gate blocks.** The `mutation` job diffs the pull request against its base, skips cleanly when the mutate scope is untouched, and otherwise runs Stryker incrementally over the changed files. `thresholds.break` fails the job below the floor, and the job sits in the `ci-success` needs list.
- **The floors are measured, not guessed.** The first full runs scored MEASURED_CONTRACTS for contracts and MEASURED_DESKTOP for the desktop main process; the break floors sit five points under each, per the ratchet discipline ADR-0015 set. Raising a floor is cheap and encouraged; lowering one needs a recorded reason here.
- **The incremental baseline is a cache artifact, never source.** Stryker's own guidance: `stryker-incremental.json` churns constantly and belongs in CI caching. Pull requests restore the newest baseline; the weekly run saves a fresh one.
- **A weekly full run informs and never blocks.** `mutation-full.yml` runs both packages on a Monday-morning cron, uploads the HTML report as an artifact, refreshes the baseline, and reports to the Stryker dashboard at `dashboard.stryker-mutator.io` under `github.com/recomposesh/recompose`, modules `contracts` and `desktop-main`. Pull request runs never report to the dashboard, because partial scores would pollute the trend.
- **A CLAUDE.md rule pairs the gate with property tests.** Node-side logic changes must survive the mutation gate, non-trivial invariants pair a property-based test with it, and a surviving mutant dies through a better test, never through a weakened threshold.
- **No lefthook leg.** Mutation runtime is unpredictable at commit time; the where-applicable clause from the Chromatic record covers the exemption.

## Alternatives

- **Mutating the renderer through browser mode**: rejected until the vitest runner supports it; the official docs still list browser mode as unsupported.
- **One root Stryker config**: rejected. Two packages with separate Vitest roots each get a config bound to their own test world; a root config would blur `perTest` coverage and module-level dashboard reporting.
- **Advisory-only mutation scores**: rejected by the maintainer's ruling; the repo bans advisory gates, and the pull request run carries the teeth.
- **Committing the incremental file**: rejected on Stryker's own guidance; it's an artifact, not source.

## Consequences

**Good**: a weak test dies in review instead of surviving into the suite. The gate scales with the diff, so small pull requests pay seconds, not minutes. The dashboard shows the trend per module, and the weekly run keeps the baseline honest against environment drift that incremental mode can't see.

**Bad, and accepted**: a pull request touching a hot module pays a real mutation bill even diff-scoped; widening the skip filter is the recorded pressure valve. Incremental mode misses dependency and environment changes by design; the weekly full run is the corrective. The engine package inherits this gate on arrival and will re-measure its own floor.
```

- [ ] **Step 2: Index row**

After the 0035 row in `docs/adr/README.md`:

```markdown
| [0036](0036-stryker-mutation-gate.md) | Stryker Mutation Gate Over the Node-Tested Surfaces | Accepted | 2026-07-26 |
```

Run `pnpm run fmt` then `pnpm run fmt:check`.

- [ ] **Step 3: Prose gates**

Run: `pnpm run lint:prose && pnpm run lint:spell`
Expected: 0 errors. Fix only by rewording THIS ADR (contractions, splits, first-use expansions); never touch vocabulary files. If cspell flags `stryker`/`mutator`/`StrykerJS`, add those words to `cspell-words.txt` (case-insensitive sort) and record it.

- [ ] **Step 4: Commit**

```bash
git add docs/adr/0036-stryker-mutation-gate.md docs/adr/README.md
git commit -m "docs(adr): stryker mutation gate record

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: PR, green, merge (controller-led)

- [ ] **Step 1: Push and open the PR** — title `test: stryker mutation gate`, body: four bullets (diff-scoped blocking gate + measured floors, weekly dashboard run, node-only scope with revisit trigger, CLAUDE.md pairing rule), test-plan checkboxes (gates green; mutation job exercises the DIFF path on this PR because Task 1 touches `packages/contracts`? No — configs sit next to `src` but outside it; state which path this PR proves: the config-only diff exercises the SKIP path; the diff path got proven locally in Task 1 Step 7-8), standard footer.
- [ ] **Step 2: CI green + CodeRabbit threads settled** (judge each finding; the mutation job on this PR must show the clean-skip log line).
- [ ] **Step 3: Merge** (attempt `gh pr merge --squash --admin` once; hand the command to the maintainer if declined).
- [ ] **Step 4: Post-merge proof** — `gh workflow run mutation-full.yml` (now registered), watch it green, confirm the dashboard shows both modules and the report artifact exists. Record in the ledger.
