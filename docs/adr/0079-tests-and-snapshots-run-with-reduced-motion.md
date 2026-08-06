# 0079: Tests and snapshots run with reduced motion

**Status**: Accepted
**Date**: 2026-08-06

## Context

The gateway inspector brought the first real animations to the renderer, and the browser suite needed a stance on motion. A snapshot taken mid-animation captures an arbitrary frame, and a spec that clicks through an animated transition races its timer. The first attempt forced `animation-duration: 0s !important` in the Storybook preview CSS, and the Human Interface Guidelines (HIG) gate rejected it as two Foundations concerns.

## Decision

The browser test context sets Playwright's `reducedMotion: 'reduce'` emulation in `vitest.config.ts`. Every animation in the design system already sits inside a `@media (prefers-reduced-motion: no-preference)` guard, so the emulation switches motion off through the same door a person with that preference uses. No override CSS exists, and no gate weakens: the tests exercise the exact code path the accessibility setting exercises in production.

## Alternatives

- **Override CSS in the Storybook preview (`animation-duration: 0s !important`)**: rejected because the HIG gate flagged it, it fights the cascade instead of using the design system's own guards, and it tests a stylesheet no user ever loads.
- **Per-test motion opt-outs**: rejected because each test would re-decide the same question, and a forgotten opt-out becomes a flake.
- **Letting animations run and waiting them out**: rejected because every animated interaction would need explicit waits, and snapshot determinism would depend on timer accuracy under load.

## Consequences

**Good**: snapshots are deterministic, animated interactions don't race timers, and the reduced-motion code path gets exercised by the whole suite, which keeps the media guards honest.

**Bad**: no test anywhere exercises an animation, so motion coverage rests on the guarded CSS being declarative and on the visual pass a human runs. Timing logic that pairs with CSS motion (such as an unmount delay) must consult the same preference, or the suite pins a behavior motion-off users shouldn't get.
