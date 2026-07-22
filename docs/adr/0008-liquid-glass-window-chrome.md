# ADR-0008: Liquid Glass Window Chrome via electron-liquid-glass

**Status**: Accepted
**Date**: 2026-07-22

## Context

The desktop shell should look native on macOS: a translucent sidebar that picks up color from the desktop and surrounding windows. macOS 26 Tahoe introduced Liquid Glass (`NSGlassEffectView`), but Electron's built-in `vibrancy` option only exposes the older `NSVisualEffectView` materials.

## Decision

Use the `electron-liquid-glass` native module: the window is created with `transparent: true` and `titleBarStyle: 'hiddenInset'` on macOS, and a glass view is attached behind the content after `did-finish-load`. The sidebar stays transparent in CSS so the glass shows through; the main area paints a semi-opaque background over it.

## Alternatives

- **Built-in `vibrancy: 'sidebar'`**: zero dependencies, but caps the look at pre-Tahoe blur — no Liquid Glass.
- **CSS `backdrop-filter`**: only blurs the app's own content, cannot sample the desktop behind the window.

## Consequences

**Good**: real Liquid Glass on macOS 26+; the module itself falls back to `NSVisualEffectView` on macOS 11–25 and is a safe no-op (`-1`) elsewhere, so no fallback code on our side. Distribution via Homebrew is unaffected — notarization does not scan for private APIs.

**Bad**: relies on a private API, so a macOS minor update can degrade the effect (visually, not a crash) — acceptable since Homebrew lets us ship fixes fast. Mac App Store distribution would be blocked by static analysis; not a current channel.
