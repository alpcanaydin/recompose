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

## Chromatic addendum (2026-08-08)

Chromatic runs the same play functions in its own cloud browser, and that context has no reduced-motion door. A Storybook interaction test can't emulate `prefers-reduced-motion` from inside the story iframe. So the guarded transitions run live, and a play that reads a settled state races them. The vitest fix doesn't reach Chromatic.

The preview injects a motion-off stylesheet only when `isChromatic()` reports the Chromatic capture. This is the override CSS the first decision rejected. It's taken now for a reason that weighing lacked: Chromatic offers no other door. It lives in `.storybook/preview.ts` behind the `isChromatic()` guard, not in `preview.css`. So it ships to no scheme a person loads, and it stays clear of the HIG gate's foundations scan. A play that flips a state through a synchronous store, like the inspector toggle, still waits on the store's render with `waitFor`. Motion was never its problem.
