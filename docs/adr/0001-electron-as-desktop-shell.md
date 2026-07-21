# ADR-0001: Electron as Desktop Shell

**Status**: Accepted
**Date**: 2026-07-21

## Context

recompose is a desktop-first, offline-first AI gateway composer with a locked "native macOS feel" design direction (Mac Native, TablePlus flavor). The signature chrome requires true native materials: Liquid Glass (`NSGlassEffectView`, macOS 26+) and sidebar vibrancy (`NSVisualEffectView`). These need a real native window handle from the shell.

## Decision

Electron 30+ is the shell. Native glass/vibrancy is applied through Meridius-Labs/electron-liquid-glass, which requires `BrowserWindow.getNativeWindowHandle()`.

## Alternatives

- **Lightweight webview shells (Tauri, Bun+Zig webviews)**: smaller bundles, but no native window handle access for glass/vibrancy — the core design requirement fails.
- **Native Swift/AppKit app**: best-possible native feel, but kills cross-platform (Win/Linux are explicit targets) and the web-based node canvas stack.

## Consequences

**Good**: real native materials on macOS; one web codebase for all platforms; mature ecosystem (electron-builder, auto-update, signing).

**Bad**: 80–150 MB bundle — accepted for an OSS pro tool. Native module (`electron-liquid-glass`) must rebuild against Electron's Node headers on every Electron upgrade.
