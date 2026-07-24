# 0003: Scaffold with electron-vite

**Status**: Accepted
**Date**: 2026-07-21

## Context

The desktop app needed a build toolchain and project scaffold. As of 2026 the ecosystem has consolidated: Vite-based tooling is the de-facto standard for new Electron projects. Webpack-era boilerplates lag behind.

## Decision

`apps/desktop` is scaffolded with electron-vite (react-ts template) and folded into the pnpm workspace.

## Alternatives

- **Electron Forge**: official all-in-one pipeline, but slower dev feedback and a more rigid config than Vite Hot Module Replacement (HMR).
- **electron-react-boilerplate / webpack templates**: mature but dated; slower builds, no main-process HMR.

## Consequences

**Good**: main/preload/renderer separation works correctly out of the box. HMR covers the main process too. Packages ship with electron-builder underneath, which the `electron-liquid-glass` native-rebuild chain (`install-app-deps`) needs anyway.

**Bad**: the template ships eslint/prettier and loose TS defaults, which repo-wide oxlint/oxfmt and the shared strict tsconfig replace. The toolkit base sets `noImplicitAny: false` by default, but the shared config overrides it.
