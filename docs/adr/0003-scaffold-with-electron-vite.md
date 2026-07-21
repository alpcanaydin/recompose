# ADR-0003: Scaffold with electron-vite

**Status**: Accepted
**Date**: 2026-07-21

## Context

The desktop app needed a build toolchain and project scaffold. As of 2026 the ecosystem has consolidated: Vite-based tooling is the de-facto standard for new Electron projects; webpack-era boilerplates are dated.

## Decision

`apps/desktop` is scaffolded with electron-vite (react-ts template) and folded into the pnpm workspace.

## Alternatives

- **Electron Forge**: official all-in-one pipeline, but slower dev feedback and a more rigid config than Vite HMR.
- **electron-react-boilerplate / webpack templates**: mature but dated; slower builds, no main-process HMR.

## Consequences

**Good**: correct main/preload/renderer separation out of the box; HMR including the main process; packages with electron-builder underneath — which the `electron-liquid-glass` native-rebuild chain (`install-app-deps`) needs anyway.

**Bad**: template ships eslint/prettier and loose TS defaults — replaced with repo-wide oxlint/oxfmt and the shared strict tsconfig (the toolkit base silently sets `noImplicitAny: false`; overridden).
