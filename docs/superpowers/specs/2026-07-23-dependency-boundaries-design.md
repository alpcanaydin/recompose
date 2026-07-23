# Dependency Boundaries — Design

Date: 2026-07-23
Status: Approved

## Context

Third infrastructure-queue item. ADR-0010 chose the tools (Steiger for FSD rules, dependency-cruiser for package/process boundaries) and the folder-structure spec wrote the dependency rules as target state, explicitly deferring machine enforcement to this job. Repo state: one workspace (`apps/desktop`), FSD renderer merged (PR #26), `packages/engine`/`packages/contracts` reserved but unopened. Consistent with ADR-0011's lesson: a rule that lives only in prose drifts.

## Decisions

- **One whole-repo import graph, configured at the root.** Cross-package rules (engine ↔ desktop ↔ contracts) only make sense over the full graph; per-package turbo tasks would split it into partial views. Both tools run in under a second — they join the root-level gate layer (like `fmt:check`), not the turbo task graph.
- **dependency-cruiser 18.1.0**, config `.dependency-cruiser.cjs` at the repo root. All rules `severity: error`.
- **Steiger 0.6.0 + @feature-sliced/steiger-plugin 0.7.0**, config `steiger.config.ts` at the repo root, `fsd.configs.recommended`, targeting `apps/desktop/src/renderer/src`.
- **Stages: pre-commit + CI** (user decision). Two lefthook pre-commit jobs and one CI `check`-job step running the same root scripts — local hooks stop violations before they leave the machine, CI is the net for `--no-verify` (ADR-0006/0007 layering).
- **Pre-staged rules ship now.** Rules for `packages/engine`, `packages/contracts`, and `apps/headless` are written today against paths that do not exist yet; they match nothing until a package opens, then bind with zero rule changes. The only touch when `packages/` first opens: adding `packages` to the scan arguments (`depcruise apps` → `depcruise apps packages`) — recorded in ADR-0014. (`includeOnly` was rejected: it filters node_modules edges out of the graph, which would silently disable the `engine-no-electron` rule.)

## dependency-cruiser rules

| Rule                      | Constraint                                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `no-circular`             | No circular imports anywhere in the repo                                                                                   |
| `renderer-isolated`       | `src/renderer/**` must not import `src/main/**` or `src/preload/**` (exception: type-only use of `src/preload/index.d.ts`) |
| `main-not-into-renderer`  | `src/main/**` must not import `src/renderer/**`                                                                            |
| `preload-isolated`        | `src/preload/**` must not import `src/main/**` or `src/renderer/**`                                                        |
| `engine-no-electron`      | `packages/engine/**` must not import `electron`                                                                            |
| `engine-only-contracts`   | `packages/engine/**` must not import `apps/**` or any workspace package other than `packages/contracts`                    |
| `desktop-not-into-engine` | `apps/desktop/**` must not import `packages/engine/**`                                                                     |
| `headless-scope`          | `apps/headless/**` may import only `packages/engine/**` and `packages/contracts/**` from the workspace                     |

## Steiger scope

`fsd.configs.recommended` over `apps/desktop/src/renderer/src` — layer order, cross-import bans, public-API rules per FSD v2.1. The current renderer (a lone `app/` layer) must pass without rule disables; any future disable requires a written reason in the config next to it.

## Wiring

- Root `package.json` scripts: `"lint:boundaries": "depcruise apps"` (gains `packages` as an argument when that directory first opens; depcruise errors on nonexistent paths, so it cannot be pre-listed) and `"lint:fsd": "steiger apps/desktop/src/renderer/src --fail-on-warnings"` (single run, non-interactive; warnings fail too — closed to interpretation).
- Lefthook `pre-commit`: two jobs, `boundaries` and `fsd`, same priority tier as the existing `lint` job.
- CI `check` job: one step `pnpm run lint:boundaries && pnpm run lint:fsd` after the existing turbo step.

## Verification

Each rule class gets a positive proof (temporary violating file → exit 1) and the negative proof (current tree → exit 0), mirroring the gitleaks/coverage-gate pattern. No permanent fixture files are committed. Pre-staged package rules are proven by creating a throwaway `packages/engine/src` violation during verification, then deleting it.

## Out of scope / deferred

- Orphan-module and dependency-hygiene rules (`no-orphans`, dev-dep checks): add when a real incident motivates them.
- Dependency-graph visualization (`depcruise --output-type dot`): on demand, not wired into CI.
- Extending Steiger with custom rules: the tool does not support external plugins yet.

## Decision record

Recorded as ADR-0014 via the `architecture-decision-records` skill during implementation (root-graph approach, pre-staged rules, stage layering).
