# 0008: Liquid glass window chrome via electron-liquid-glass

**Status**: Accepted
**Date**: 2026-07-22

## Context

The desktop shell should look native on macOS: a translucent sidebar that picks up color from the desktop and surrounding windows. macOS 26 Tahoe introduced Liquid Glass (`NSGlassEffectView`), but Electron's built-in `vibrancy` option only exposes the older `NSVisualEffectView` materials.

## Decision

Use the `electron-liquid-glass` native module: it creates the window with `transparent: true` and `titleBarStyle: 'hiddenInset'` on macOS, and attaches a glass view behind the content after `did-finish-load`. The sidebar stays transparent in CSS so the glass shows through. The main area paints a semi-opaque background over it.

## Alternatives

- **Built-in `vibrancy: 'sidebar'`**: zero dependencies, but caps the look at pre-Tahoe blur, without Liquid Glass.
- **CSS `backdrop-filter`**: only blurs the app's own content, can't capture the desktop behind the window.

## Consequences

**Good**: real Liquid Glass works on macOS 26+. The module itself falls back to `NSVisualEffectView` on macOS 11–25 and is a safe no-op (`-1`) elsewhere, so the app needs no fallback code. Homebrew distribution stays unaffected, since notarization doesn't scan for private APIs.

**Bad**: relies on a private API, so a macOS minor update can degrade the effect (visually, not a crash), an acceptable risk since Homebrew lets the maintainer ship fixes fast. Static analysis would block Mac App Store distribution, which isn't a current channel.
