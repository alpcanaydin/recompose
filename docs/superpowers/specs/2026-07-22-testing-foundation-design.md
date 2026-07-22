# Testing Foundation — Design

Date: 2026-07-22
Status: Approved

## Context

The infrastructure queue reached its second item: the unit/integration layers of the test pyramid. Repo state: one workspace (`apps/desktop`, Electron 43 + React 19 + Vite 8), turbo `test` task defined but empty, no test files, CI `check` job already runs `turbo run test`. E2E (Playwright), Storybook, Chromatic, and mutation testing are separate queue items and out of scope here.

Prior decisions that bind this design: tests are colocated with source; TDD/BDD rules in `.claude/rules/tdd-bdd.md` (state-based, doubles only at process boundaries, behavior specs); the renderer follows FSD v2.1 (PR #26, unmerged — see Interplay below).

## Decisions

- **Runner: Vitest 4** (latest 4.x at implementation time). `workspace` is deprecated; environment splits use the `projects` config.
- **Topology: per-package config + `turbo test`** (Turborepo's official guidance — per-package caching; unchanged packages never re-run tests). Each package gets `vitest.config.ts` and a `"test": "vitest run"` script. Shared settings live in a root `vitest.shared.ts` that package configs extend. No `packages/vitest-config` workspace package until a second consumer exists.
- **Renderer DOM tests run in a real browser: Vitest Browser Mode** (stable in v4), provider `playwright()` from `@vitest/browser-playwright`, single instance `{ browser: 'chromium' }`, rendering via `vitest-browser-react`. No jsdom/happy-dom anywhere — no simulation layer. Chosen deliberately over the lighter option: this app is a node-based canvas UI where simulated-DOM fidelity is weakest.
- **Property-based testing: fast-check v4 via `@fast-check/vitest`** (`test.prop` API, seed replay, shrinking).
- **Coverage: `@vitest/coverage-v8` with a CI-enforced gate** — thresholds `lines/branches/functions/statements ≥ 90` defined once in `vitest.shared.ts`. Below threshold → vitest exits 1 → turbo → CI red.
- **No test hook in lefthook.** Browser Mode per commit is too heavy; lefthook stays unchanged. The gate is CI: the `check` job already runs `turbo run test`, and gains one step installing Chromium for Browser Mode (see the plan and ADR-0012).

## Environment split (`projects` inside apps/desktop)

Two projects with a deterministic filename boundary — no per-file docblocks, no judgment calls:

| Project   | Environment             | Include                                                 | Covers                             |
| --------- | ----------------------- | ------------------------------------------------------- | ---------------------------------- |
| `unit`    | node                    | `src/**/*.test.{ts,tsx}` (excluding `*.browser.test.*`) | main, preload, renderer pure logic |
| `browser` | Browser Mode (Chromium) | `src/renderer/**/*.browser.test.tsx`                    | anything that touches the DOM      |

The rule an implementer follows: touches the DOM → `.browser.test.tsx`; doesn't → `.test.ts`. A misnamed file simply never runs, which drops coverage below the gate and fails CI — the convention is self-enforcing.

`electron` module imports in main-process tests may be mocked: Electron is a process boundary, consistent with the TDD rule that doubles are allowed only at real boundaries.

## fast-check conventions

- Property tests are colocated in the same `.test.ts` file as example tests, written with `test.prop`.
- Core domain logic (when the engine lands: routing, failover, protocol translation — until then, any pure-function layer) gets both example tests and property tests.
- `numRuns`: default 100 for in-memory properties; 10–20 for properties whose predicate does I/O.
- A failing seed found in CI is pinned into the test as `{ seed }` alongside the fix, so the regression case replays forever.

## Coverage gate details

- Provider: V8. Reporters: `text` (local) + `lcov` (CI artifact/upload-ready).
- Excluded from coverage: config files (`*.config.*`), `out/`, `dist/`, test files themselves, type-declaration files, and process boundary wiring files (entry points that only compose — the corollary rule: logic never lives in them, it is extracted to tested modules).
- Thresholds live in `vitest.shared.ts` only — a package cannot silently lower them without touching the shared file.

## Proof tests

The harness ships with the minimum set of real behavior specs proving each layer works — no dummy tests (TDD invariant: test code exists iff behavior exists):

1. One node unit test against existing main-process behavior (e.g. window construction options as observable state, with `electron` mocked at the boundary).
2. One Browser Mode test rendering the current renderer shell and asserting its visible structure.
3. One property test via `test.prop` on an existing pure function (extracting one if none exists yet — the extraction itself must be behavior-preserving and useful, not ceremonial).

## Turbo wiring

- `test` task: `dependsOn: []` (tests don't need build — Vite transforms on the fly), inputs default + shared config file, outputs `coverage/**` for cache replay.
- Root `pnpm test` → `turbo run test` (already wired).

## Interplay with PR #26 (FSD)

This branch is based on origin/main without the FSD renderer moves. Colocated tests travel with their files; the project globs match on suffix, not on FSD paths, so the merge order is irrelevant — at most a trivial rebase.

## Out of scope / deferred

- Playwright E2E, Storybook, Chromatic, mutation testing: separate queue items.
- Multi-browser instances in Browser Mode: Chromium only until a cross-browser requirement exists (the shipped product is Electron/Chromium).
- Merged monorepo-wide coverage report: per-package reports suffice for one package; revisit when a second package lands.

## Decision record

The tooling choice (Vitest 4 + Browser Mode + fast-check + coverage gate) is recorded as an ADR via the `architecture-decision-records` skill during implementation.
