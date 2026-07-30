# 0053: Flow green is a canvas token the palette doesn't carry yet

**Status**: Accepted
**Date**: 2026-07-30

## Context

Issue #90 read `--color-success: light-dark(var(--green-600), var(--green-500))` against the brainstorm lock, which fixes flow green at `#32d74b` dark and `#1a9e33` light. The dark side matched exactly and the light side didn't: `#28cd41` against `#1a9e33`. The issue offered two readings, that the primitive drifted or that flow green is a separate future canvas token, and asked for a decision.

Measurement settles it, and adds a third fact the issue couldn't have.

- The primitive pair is Apple's macOS systemGreen, `#32d74b` dark and `#28cd41` light. Every other primitive in the file is an Apple system color too: `#0a84ff` and `#007aff` systemBlue, `#ff453a` and `#ff3b30` systemRed, `#ff9f0a` systemOrange, `#bf5af2` systemPurple, `#ffd60a` systemYellow. Nothing drifted. Flow green shares a value with systemGreen in dark and parts from it in light, which is what made the pair look like one color.
- The lock reserves flow green for one job: the live-traffic signature on the canvas, recompose's brand moment. A settings switch isn't live traffic.
- `--color-success` has **no consumers**. The issue records the settings switch as one, which held on the day it went in. The Apple Human Interface Guidelines pass later in the settings-screen change then moved the switch to the accent color and left the token behind. The only reference to it in the tree is its own declaration.

A semantic token nobody uses, sitting one letter away from a locked brand color it isn't, is how the next reader wires a switch to the wrong green.

## Decision

`--color-success` leaves `theme.css`. The primitives stay untouched, because they carry the Apple system palette correctly.

Flow green gets its own token when the canvas gains live traffic, carrying the locked values rather than a systemGreen alias. Sharing the dark value is a coincidence of two palettes, not a reason to share a token.

## Alternatives

- **Point `--color-success` at the locked flow-green values**: makes an unused token carry a brand color reserved for a surface that doesn't exist yet, and invites any future success state to borrow the live-traffic signature.
- **Add a flow-green token now**: the canvas has no live traffic to paint, so the token would land untested and unproven against its background.
- **Leave the token alone**: keeps the contradiction the issue found, and the next reader pays for it.

## Consequences

**Good**: the palette says only what the app uses. The locked flow green stays reserved for the canvas, where a designer can hold its light value against the surface it actually sits on.

**Bad**: a future success state has no semantic token and has to add one. That's the right moment to pick its value against a real background rather than now.
