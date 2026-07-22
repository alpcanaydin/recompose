# ADR-0009: Two-Tier Design Tokens on Tailwind v4

**Status**: Accepted
**Date**: 2026-07-22

## Context

The renderer needed a design token foundation before any UI work could proceed:
a way to carry color, type, and radius values from the Claude Design project
**recompose-design-system** into the app without every component reaching for
raw hex values, and without a mapping so elaborate it becomes its own
maintenance burden. Tailwind v4 changes how tokens are declared (CSS-first, no
`tailwind.config.*`), and the shell needs to theme with the OS light/dark
setting rather than a manual toggle.

## Decision

Adopt a two-tier token architecture: primitive → semantic, no component tier.
Primitives are raw, theme-agnostic values (`--blue-500`, `--gray-900`, alpha
scales) declared as plain CSS variables in `:root`; they never appear in
component code and never become Tailwind utilities. Semantic tokens carry
intent (`--color-surface-content`, `--color-ink-secondary`) and are declared in
`@theme`, so they and only they generate Tailwind utilities
(`bg-surface-content`, `text-ink-secondary`). Every semantic color resolves
through `light-dark(<light primitive>, <dark primitive>)`; theming follows
`:root { color-scheme: light dark }` with zero JS and zero IPC. Text and
border tokens are named `ink` and `line` rather than `text`/`border`, so the
generated utilities read naturally instead of stuttering (`text-text-*`).
Tailwind's default `--color-*`, `--text-*`, and `--radius-*` namespaces are
reset to `initial` wherever we own the scale, so a primitive utility
(`bg-red-500`) is structurally impossible — only semantic utilities exist.
Tailwind's default spacing scale is kept as-is: it already matches the
design's 4px grid. The token files live alongside the app
(`apps/desktop/src/renderer/src/assets/{primitives,theme}.css`) rather than in
a separate `packages/ui` — the renderer is the only consumer today. The Claude
Design project remains the visual source of truth (what things look like);
token naming and structure are owned by the codebase, decided here.

## Alternatives

- **Three-tier (primitive → semantic → component)**: the common enterprise
  pattern, but multiplies token count roughly tenfold for a benefit that only
  pays off once many teams share components across products. Foundations have
  no components yet; revisit if concrete pressure appears.
- **`tailwind.config.ts` (v3-style JS config)**: still supported in v4 via a
  compatibility path, but fights the framework's own direction and keeps
  tokens out of the CSS cascade where `light-dark()` needs them.
- **Manual theme toggle (JS-driven `class="dark"`)**: works but requires
  state, persistence, and an IPC round-trip in Electron for the initial
  paint. `color-scheme` + `light-dark()` gets the same result from the OS for
  free, at the cost of not supporting an in-app override yet — a manual
  setting is one added line (`color-scheme: dark` on root) with no token
  changes.
- **`packages/ui` workspace package now**: correct once a second consumer
  exists (e.g. a marketing site or Storybook), but today it's an empty
  boundary that adds workspace/build overhead for one consumer.

## Consequences

**Good**: component code can only reach for tokens that already carry
light/dark values, so a missing theme mapping fails loudly (invisible text or
borders) rather than silently rendering the wrong hex. The namespace reset
makes the primitive/semantic boundary a compiler-enforced rule, not a
convention. No JS theming code exists to keep in sync with the OS setting.

**Bad**: some values used by later features (canvas node tints, control row
heights) don't have semantic tokens yet — deferred until the features that
need them land, so those PRs must add the semantic line rather than reach for
a primitive directly. The `ink`/`line` naming departs from the more common
`text`/`border` vocabulary seen in other design systems, trading familiarity
for utility-name ergonomics.
