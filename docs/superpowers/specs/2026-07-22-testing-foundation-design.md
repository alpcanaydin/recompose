# Testing foundation: Design

Date: 2026-07-22
Status: Approved

## Context

The infrastructure queue reached its second item: the unit/integration layers of the test pyramid. Repo state: one workspace (`apps/desktop`, Electron 43 + React 19 + Vite 8), turbo `test` task defined but empty, no test files, CI `check` job already runs `turbo run test`. E2E (Playwright), Storybook, Chromatic, and mutation testing are separate queue items and out of scope here.

Prior decisions bind this design. Tests are colocated with source, following the Test-Driven Development (TDD) / Behavior-Driven Development (BDD) rules in `.claude/rules/tdd-bdd.md` (state-based, doubles only at process boundaries, behavior specs). The renderer follows Feature-Sliced Design (FSD) v2.1 (PR #26, unmerged, described further in Interplay below).

## Decisions

- **Runner: Vitest 4** (latest 4.x at implementation time). Vitest deprecates `workspace`, so environment splits use the `projects` config.
- **Topology: per-package config + `turbo test`** (Turborepo's official guidance: per-package caching means unchanged packages never re-run tests). Each package gets `vitest.config.ts` and a `"test": "vitest run"` script. Shared settings live in a root `vitest.shared.ts` that package configs extend. No `packages/vitest-config` workspace package until a second consumer exists.
- **Renderer DOM tests run in a real browser: Vitest Browser Mode** (stable in v4), provider `playwright()` from `@vitest/browser-playwright`, single instance `{ browser: 'chromium' }`, rendering via `vitest-browser-react`. No jsdom/happy-dom anywhere, with no simulation layer. Chosen over the lighter option: this app is a node-based canvas UI where simulated-DOM fidelity is weakest.
- **Property-based testing: fast-check v4 via `@fast-check/vitest`** (`test.prop` API, seed replay, shrinking).
- **Coverage: `@vitest/coverage-v8` with a CI-enforced gate**, with thresholds `lines/branches/functions/statements ≥ 90` defined once in `vitest.shared.ts`. Below threshold → vitest exits 1 → turbo → CI red.
- **No test hook in lefthook.** Browser Mode per commit is too heavy, so lefthook stays unchanged. The gate is CI: the `check` job already runs `turbo run test`, and gains one step installing Chromium for Browser Mode (see the plan and Architecture Decision Record (ADR) 0012).

## Environment split (`projects` inside apps/desktop)

Two projects with a deterministic filename boundary: no per-file docblocks, no judgment calls.

| Project   | Environment             | Include                                                 | Covers                             |
| --------- | ----------------------- | ------------------------------------------------------- | ---------------------------------- |
| `unit`    | node                    | `src/**/*.test.{ts,tsx}` (excluding `*.browser.test.*`) | main, preload, renderer pure logic |
| `browser` | Browser Mode (Chromium) | `src/renderer/**/*.browser.test.tsx`                    | anything that touches the DOM      |

The rule an implementer follows: touches the DOM → `.browser.test.tsx`, and doesn't → `.test.ts`. A misnamed file simply never runs. This drops coverage below the gate and fails CI, because the convention is self-enforcing.

Main-process tests may mock `electron` module imports, since Electron is a process boundary. This matches the TDD rule: doubles belong only at real boundaries.

## Conventions for fast-check

- Property tests are colocated in the same `.test.ts` file as example tests, written with `test.prop`.
- Core domain logic (routing, failover, protocol translation once the engine lands, or any pure-function layer until then) gets both example tests and property tests.
- `numRuns`: default 100 for in-memory properties; 10–20 for properties whose predicate does I/O.
- When CI finds a failing seed, the fix pins it into the test as `{ seed }`, so the regression case replays forever.

## Coverage gate details

- Provider: V8. Reporters: `text` (local) + `lcov` (CI artifact/upload-ready).
- Excluded from coverage: config files (`*.config.*`), `out/`, `dist/`, test files themselves, type-declaration files, and process boundary wiring files. These are entry points that only compose, following the corollary rule that logic never lives in them: tested modules hold it instead.
- Thresholds live in `vitest.shared.ts` only, so a package can't lower them without touching the shared file.

## Proof tests

The harness ships with the minimum set of real behavior specs proving each layer works, with no dummy tests (TDD invariant: test code exists iff behavior exists):

1. One node unit test for existing main-process behavior (for example, window construction options as observable state, with `electron` mocked at the boundary).
2. One Browser Mode test rendering the current renderer shell and asserting its visible structure.
3. One property test via `test.prop` on an existing pure function, extracting one if none exists yet. The extraction itself must be behavior-preserving and useful, not ceremonial.

## Turbo wiring

- `test` task: `dependsOn: []` (tests don't need build, since Vite transforms on the fly), inputs default + shared config file, outputs `coverage/**` for cache replay.
- Root `pnpm test` → `turbo run test` (already wired).

## Interplay with PR #26

This branch builds on origin/main without the FSD renderer moves. Colocated tests travel with their files, and the project globs match on suffix, not on FSD paths, so the merge order is irrelevant. At most, this needs a trivial rebase.

## Out of scope / deferred

- Playwright E2E, Storybook, Chromatic, mutation testing: separate queue items.
- Multi-browser instances in Browser Mode: Chromium only until a cross-browser requirement exists (the shipped product is Electron/Chromium).
- Merged monorepo-wide coverage report: per-package reports suffice for one package; revisit when a second package lands.

## Decision record

Implementation records the tooling choice (Vitest 4 + Browser Mode + fast-check + coverage gate) as an ADR via the `architecture-decision-records` skill.
