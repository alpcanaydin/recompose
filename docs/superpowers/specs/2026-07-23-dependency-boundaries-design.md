# Dependency boundaries: Design

Date: 2026-07-23
Status: Approved

## Context

Third infrastructure-queue item. Architecture Decision Record (ADR) ADR-0010 chose the tools: Steiger for Feature-Sliced Design (FSD) rules and dependency-cruiser for package/process boundaries. The folder-structure spec wrote the dependency rules as target state and explicitly deferred machine enforcement to this job. Repo state: one workspace (`apps/desktop`), FSD renderer merged (PR #26), `packages/engine`/`packages/contracts` reserved but unopened. Consistent with ADR-0011's lesson: a rule that lives only in prose drifts.

## Decisions

- **One whole-repo import graph, configured at the root.** Cross-package rules (engine ↔ desktop ↔ contracts) only make sense over the full graph. Per-package turbo tasks would split it into partial views. Both tools run in under a second, so they join the root-level gate layer (like `fmt:check`) instead of the turbo task graph.
- **dependency-cruiser 18.1.0**, config `.dependency-cruiser.cjs` at the repo root. All rules `severity: error`.
- **Steiger 0.6.0 + @feature-sliced/steiger-plugin 0.7.0**, config `steiger.config.ts` at the repo root, `fsd.configs.recommended`, targeting `apps/desktop/src/renderer/src`.
- **Stages: pre-commit + CI** (user decision). Two lefthook pre-commit jobs and one CI `check`-job step run the same root scripts. Local hooks stop violations before they leave the machine. CI serves as the net for `--no-verify` (ADR-0006/0007 layering).
- **Pre-staged rules ship now.** This plan already writes rules for `packages/engine`, `packages/contracts`, and `apps/headless` against paths that don't exist yet. They match nothing until a package opens, then bind with zero rule changes. The only touch when `packages/` first opens: adding `packages` to the scan arguments (`depcruise apps` → `depcruise apps packages`), recorded in ADR-0014. (This design rejected `includeOnly` because it filters node_modules edges out of the graph, which would disable the `engine-no-electron` rule without warning.)

## dependency-cruiser rules

| Rule                      | Constraint                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `no-circular`             | No circular imports anywhere in the repo                                                                                             |
| `renderer-isolated`       | `src/renderer/**` must not import `src/main/**` or `src/preload/**` (exception: imports of `src/preload/index.d.ts`)                 |
| `main-not-into-renderer`  | `src/main/**` must not import `src/renderer/**`                                                                                      |
| `preload-isolated`        | `src/preload/**` must not import `src/main/**` or `src/renderer/**`                                                                  |
| `engine-no-electron`      | `packages/engine/**` must not import `electron`                                                                                      |
| `engine-only-contracts`   | `packages/engine/**` must not import `apps/**` or any workspace package other than `packages/contracts`                              |
| `desktop-not-into-engine` | `apps/desktop/**` must not import `packages/engine/**`                                                                               |
| `headless-scope`          | `apps/headless/**` may import only `packages/engine/**` and `packages/contracts/**` from the workspace                               |
| `no-phantom-deps`         | No imports of npm packages undeclared in the owning `package.json`                                                                   |
| `not-to-unresolvable`     | No imports unresolvable on disk (exception: the electron-vite `?asset` query import)                                                 |
| `no-orphans`              | No dead modules (exceptions: `.d.ts` files, `*.test.ts(x)`/`*.browser.test.tsx` files, and process entry points)                     |
| `not-to-test`             | Production code must not import `*.test.ts(x)` or `*.browser.test.tsx` files                                                         |
| `no-deprecated-core`      | No imports of deprecated Node.js core modules (`punycode`, `domain`, `constants`, `sys`, `_linklist`, `_stream_wrap`)                |
| `no-duplicate-dep-types`  | No import edge classified under more than one non-type-only dependency type (for example, both `dependencies` and `devDependencies`) |

## Steiger scope

`fsd.configs.recommended` over `apps/desktop/src/renderer/src`: layer order, cross-import bans, public-API rules per FSD v2.1. The current renderer (a lone `app/` layer) must pass without rule disables. Any future disable requires a written reason in the config next to it.

## Wiring

- Root `package.json` scripts: `"lint:boundaries": "depcruise apps"` (gains `packages` as an argument once that directory exists, since depcruise errors on nonexistent paths and can't have it pre-listed) and `"lint:fsd": "steiger apps/desktop/src/renderer/src --fail-on-warnings"` (single run and non-interactive, since warnings fail too and leave no room for interpretation).
- Lefthook `pre-commit`: two jobs, `boundaries` and `fsd`, same priority tier as the existing `lint` job.
- CI `check` job: one step `pnpm run lint:boundaries && pnpm run lint:fsd` after the existing turbo step.

## Verification

Each rule class gets a positive proof (temporary violating file → exit 1) and the negative proof (current tree → exit 0), mirroring the gitleaks/coverage-gate pattern. Verification never commits permanent fixture files. It proves pre-staged package rules by creating a throwaway `packages/engine/src` violation, then deleting it.

## Out of scope / deferred

- `not-to-dev-dep`: rejected outright, not deferred. In an Electron app, the entire toolchain, including build plugins, test runners, and even `electron` itself, is a devDependency by design, so the rule would drown in exceptions rather than catch anything real.
- Dependency-graph visualization (`depcruise --output-type dot`): on demand, not wired into CI.
- Extending Steiger with custom rules: the tool doesn't support external plugins yet.

## Decision record

Recorded as ADR-0014 via the `architecture-decision-records` skill during implementation (root-graph approach, pre-staged rules, stage layering).
