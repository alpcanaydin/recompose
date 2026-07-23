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
- **`@swc/core` (pinned 1.15.46) is a root devDependency** solely because dependency-cruiser 18.1.0 hard-rejects typescript >= 7 (the repo pins 7.0.2) — without swc present, zero `.ts`/`.tsx` files were scanned and the gate was silently empty. With swc installed as an auto-detected fallback, all TS files are scanned and type-only imports are seen (proven empirically). The trap: dependency-cruiser's explicit `parser: 'swc'` option must NOT be enabled — its swc integration lacks tsx support and crashes on any JSX file; `tsPreCompilationDeps: true` is currently inert for the same TS-7 reason and is kept harmlessly. A future "config cleanup" reversing either decision re-opens the hole.
- **`@steiger/toolkit` (pinned 0.2.3, matching upstream's own pin) is a root devDependency** because steiger/plugin published type declarations reference it without declaring the dependency; without it, oxlint's type-aware rules fail on `steiger.config.ts` (tsc stays silent only via skipLibCheck). This pin carries a benign unmet-peer warning against vitest 4 — known and accepted.

## Alternatives

- **Per-package turbo tasks**: fits turbo's caching model but splits the one graph cross-package rules need; sub-second tools gain nothing from caching.
- **eslint-plugin-boundaries**: needs an ESLint toolchain the repo deliberately does not have (oxlint ecosystem, ADR-0010).
- **CI-only**: catches violations after they are public; the local hook stops them at commit time, CI remains the net for `--no-verify`.

## Consequences

**Good**: every dependency rule from the folder-structure spec is now an exit code; violations cannot be committed locally or merged remotely; the engine's purity rules exist before the engine does, so its first line of code is already fenced.

**Bad**: two more pre-commit seconds; the scan-argument change when `packages/` opens is a manual step this ADR must be trusted to surface; Steiger cannot take custom rules yet, so renderer rules are capped at the FSD recommended set; the electron rule matches specifiers by name (`^electron(/|$)`, including subpaths like `electron/utility`) because pnpm's isolated layout keeps them unresolvable from unopened packages; the swc and steiger/toolkit pins are upgrade-coupled to dependency-cruiser's and steiger's own versions.
