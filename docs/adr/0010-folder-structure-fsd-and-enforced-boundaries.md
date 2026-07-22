# ADR-0010: Folder Structure — FSD Renderer, Enforced Boundaries

**Status**: Accepted
**Date**: 2026-07-22

## Context

Feature development is about to start. Placement decisions ("where does
this file go") must be closed to interpretation so they cannot drift
between coding sessions; every rule must be machine-enforceable. Full
design: `docs/superpowers/specs/2026-07-22-folder-structure-design.md`.

## Decision

- **Monorepo map**: `apps/desktop` (exists) plus reserved names
  `packages/engine`, `packages/contracts`, `apps/headless`. A package
  opens with its first real code; its boundary rules exist beforehand.
  Direction: `apps/desktop → packages/contracts ← packages/engine`;
  engine never imports `electron` or any workspace package but
  `contracts`; engine internals get their own ADR when the package opens.
- **Main process**: `main/index.ts` is bootstrap only; modules
  `windows/`, `ipc/`, `engine-host/` (utilityProcess spawn + engine
  entry). `preload/` stays a single file by design — growth there means
  the exposed API surface is too wide.
- **Renderer**: Feature-Sliced Design v2.1 — layers
  `app/pages/widgets/features/entities/shared`, opened on demand
  (minimal valid tree: `app + pages + shared`). Placement follows
  v2.1 "start simple": new code lands in its `pages/` slice and moves
  down only on confirmed multi-use, decided via the
  `feature-sliced-design` skill. Purpose-named segments
  `ui/model/api/lib` (essence names `components/hooks/types/utils`
  forbidden), slice public API via `index.ts` (`shared/` per segment),
  TanStack route files in `app/routes/` delegating to `pages/`.
- **Tests**: colocated `*.test.ts`; Playwright e2e in `apps/desktop/e2e/`.
- **Enforcement**: Steiger for FSD rules, dependency-cruiser for package
  direction, process boundaries, engine purity, and import cycles —
  configured in the upcoming tooling jobs, rules fixed here.

## Alternatives

- **Bespoke feature-based hybrid (bulletproof-react style)**: lighter,
  but its rules exist only as far as we write them — every unwritten
  gap is interpretation room, exactly what this decision removes. FSD
  is externally documented and has an official linter.
- **Technical layers (`components/hooks/utils`)**: does not scale past a
  handful of screens and conflicts with the clean-code naming rules.
- **Steiger alone (no dependency-cruiser)**: Steiger only sees FSD; it
  cannot express monorepo direction, Electron process borders, or the
  engine purity rule.

## Consequences

**Good**: placement questions are pre-answered by a published
methodology; both rule sets are lintable in CI; reserved package names
make future boundaries explicit today.

**Bad**: FSD ceremony (slice public APIs, entity/feature categorization)
on a one-person project; two structure linters to configure and keep
green.
