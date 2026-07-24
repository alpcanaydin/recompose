# 0001: Electron as desktop shell

**Status**: Accepted
**Date**: 2026-07-21

## Context

recompose is a desktop-first, offline-first AI gateway composer with a locked "native macOS feel" design direction (Mac Native, TablePlus flavor). The signature chrome requires true native materials: Liquid Glass (`NSGlassEffectView`, macOS 26+) and sidebar vibrancy (`NSVisualEffectView`). These need a real native window handle from the shell.

## Decision

Electron 30+ is the shell. Meridius-Labs/electron-liquid-glass applies native glass/vibrancy and requires `BrowserWindow.getNativeWindowHandle()`.

## Alternatives

- **Lightweight webview shells (Tauri, Bun+Zig webviews)**: smaller bundles, but no native window handle access for glass/vibrancy, so the core design requirement fails.
- **Native Swift/AppKit app**: best-possible native feel, but kills cross-platform (Win/Linux are explicit targets) and the web-based node canvas stack.

## Consequences

**Good**: real native materials on macOS. One web codebase covers all platforms. The ecosystem is mature (electron-builder, automatic updates, signing).

**Bad**: the bundle runs 80–150 MB, an accepted cost for an OSS pro tool. The native module (`electron-liquid-glass`) must rebuild to match Electron's Node headers on every Electron upgrade.
