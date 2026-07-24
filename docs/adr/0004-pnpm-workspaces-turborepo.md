# 0004: pnpm workspaces + Turborepo

**Status**: Accepted
**Date**: 2026-07-21

## Context

The repo hosts the Electron app and future packages (engine, design system). It needs workspace management and a task runner with correct caching. Bun is absent from the stack entirely (see Architecture Decision Record (ADR) 0002), so its package manager isn't a candidate.

## Decision

pnpm workspaces (`apps/*`, `packages/*`) with Turborepo on top. Tasks live in package scripts. Root scripts only delegate via `turbo run`.

## Alternatives

- **Bun as package manager**: fast installs, but electron-builder's native-rebuild chain is unproven with it and `electron-liquid-glass` makes that chain load-bearing.
- **pnpm alone**: sufficient at 1 package, but adds no task graph/caching once engine and design-system packages land; Turborepo is cheap to add early.
- **Nx**: more features than the project needs, which conflicts with You Aren't Gonna Need It (YAGNI).

## Consequences

**Good**: proven native-rebuild path for Electron. Single lockfile. Cached, graph-ordered tasks (`build` depends on `typecheck`).

**Bad**: root-level configs are invisible to turbo's default hashing, so tasks must declare `tsconfig.strict.json` and `.oxlintrc.json` as `$TURBO_ROOT$` inputs, or cache results go stale. This is already configured. Keep it in mind for every new root config.
