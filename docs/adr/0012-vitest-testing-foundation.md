# 0012: Vitest testing foundation with browser mode and property testing

**Status**: Accepted
**Date**: 2026-07-23

## Context

The infrastructure queue reached the unit/integration layers of the test pyramid. The repo had a turbo `test` task with no runner behind it. Prior commitments bind the choice. Tests are colocated, and Test-Driven Development (TDD) is mandatory (`.claude/rules/tdd-bdd.md`). The renderer is a node-based canvas UI where simulated-DOM fidelity is weakest, and the CI `check` job already runs `turbo run test`.

## Decision

- **Vitest 4** as the runner, configured per package with a `projects` split inside `apps/desktop`: `unit` (node environment: main, preload, renderer pure logic) and `browser` (Browser Mode on real Chromium via `@vitest/browser-playwright`, rendering with `vitest-browser-react`). No jsdom/happy-dom anywhere; the filename decides the environment (`*.browser.test.tsx` vs `*.test.ts`).
- **fast-check v4 via `@fast-check/vitest`** for property-based testing, colocated in the same spec files (`test.prop`). Core domain logic gets example and property specs.
- **Coverage gate**: `@vitest/coverage-v8` with `lines/branches/functions/statements ≥ 90`, thresholds defined once in the root `vitest.shared.ts`. `coverage.include` spans all `src/`, so an untested (or misnamed) file lowers the coverage percentage. The config excludes process boundary wiring files (`src/main/index.ts`, `src/main/windows/main-window.ts`, `src/preload/index.ts`, `src/renderer/src/app/main.tsx`) as pure composition, because logic never lives in them.
- **Turbo wiring**: per-package `test` script (Turborepo guidance over root-level projects), `coverage/**` cached as task output. CI gains one step: `playwright install --with-deps chromium`. The root package.json carries a pinned vitest devDependency solely so `vitest.shared.ts` can type its export using the `vitest/node` types.

## Alternatives

- **jsdom/happy-dom for renderer tests**: faster and dependency-free, but a simulation, weakest exactly where this app lives (canvas layout, pointer interaction, real CSS). Rejected for fidelity; Browser Mode is stable in Vitest 4.
- **Root-level Vitest projects for the whole monorepo**: single command and merged coverage, but defeats turbo's per-package caching; Turborepo documents it as the compatibility path, not the recommended one.
- **Coverage as report-only**: no machine pressure. Rejected, because prose-only rules drift (Architecture Decision Record (ADR) 0011's lesson), and TDD makes the threshold cheap to hold.

## Consequences

**Good**: the filename decides the environment, not judgment. DOM specs run where the app actually runs, in Chromium. Property tests share the runner and reporter. The coverage gate turns "every layer has tests" from prose into an exit code. Unchanged packages skip their test task entirely via turbo cache.

**Bad**: Browser Mode needs a Chromium download locally and in CI (one install step, ~30s uncached). Coverage thresholds are repo-global, so a future package with a legitimate reason for lower coverage has to argue with the shared file. Entry-file exclusion relies on the extraction discipline the plan establishes.
