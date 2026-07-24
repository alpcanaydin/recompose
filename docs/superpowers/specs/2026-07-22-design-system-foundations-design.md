# Design system foundations: Design

Date: 2026-07-22
Status: approved for planning

## Goal

Establish the design token foundation for the recompose renderer. This spec covers a two-tier token
architecture implemented in Tailwind CSS v4, with the existing shell (sidebar +
main area) restyled through it. Visual values come from the Claude Design project
**recompose-design-system**. This spec defines token names and structure, following
recompose's conventions, because the Design project shows what things look like, not how they're named.

## Decisions

1. **Two-tier token architecture** (industry standard): primitive → semantic.
   - Primitives are raw, theme-agnostic values. They never appear in component code
     and never become Tailwind utilities.
   - Semantic tokens carry intent (`surface-content`, `ink-secondary`) and are the
     only tokens components touch. Text tokens use `ink` and borders use `line`,
     so the generated utilities read cleanly (`text-ink-secondary`,
     `border-line-subtle`). A `--color-text-*` token would instead generate a stuttering
     `text-text-*` utility. All theming happens at this tier via `light-dark()`.
   - Dependency flow is one-way: primitive → semantic. Never the reverse.
   - **No component-token tier.** Components consume semantic tokens directly.
     Component tokens multiply token count ~10× and pay off only at enterprise
     scale. Revisit only if concrete pressure appears.
2. **Tailwind v4, CSS-first.** No `tailwind.config.*`; tokens live in CSS.
   Primitives in `:root`, semantic tokens in `@theme` (per official guidance:
   `@theme` is only for tokens that should become utilities).
3. **Default namespaces reset** where recompose owns the scale: `--color-*: initial`,
   `--text-*: initial`, `--radius-*: initial`. Only semantic utilities exist, so a
   primitive leak (`bg-red-500`) is structurally impossible. Tailwind's default
   spacing scale stays: it's already the 4px grid the design uses (`p-1` = 4px
   … `p-6` = 24px) and serves as recompose's spacing primitive tier.
4. **Theme follows the OS.** Setting `:root { color-scheme: light dark }` means every
   `light-dark()` resolves automatically. Zero JS, zero Inter-Process Communication (IPC), no toggle. A manual
   theme setting later is one line (`color-scheme: dark` on root) and touches no
   tokens. Dark is the design's default character.
5. **No separate UI package.** The desktop renderer is the only consumer, so the
   architectural boundary is a folder, not a workspace package. Move to
   `packages/ui` when a second consumer actually exists.
6. **oxfmt sorts Tailwind classes.** Enable oxfmt's Tailwind class sorting and
   point it at the renderer's entry stylesheet so semantic utilities sort correctly. Exact
   config key resolved at implementation time.
7. **Deferred:**
   - Canvas tokens (node tints, `shadow-node`, dot grid) → arrive with the canvas
     feature. The accent primitives they map to ship now, so each is one semantic line.
   - Control heights (`h-row: 28px` etc.) → arrive with the first control component.
   - Class Variance Authority (CVA), the class-variance-authority package → adopt when the first variant-bearing
     component lands. Foundations have no components.

## Token inventory

This spec pulls token values from the Claude Design project (tokens/*.css) and normalizes them:
it consolidates `#28282b` and `#28282c` into the single value `#28282c` (closest-match normalization).

### Primitives (`:root`, plain CSS variables)

Accent palette: macOS system colors, where `-600` is the light-theme variant and `-500` the
dark-theme variant (higher number = darker holds for every pair):

| Primitive      | Value     | Primitive      | Value     |
| -------------- | --------- | -------------- | --------- |
| `--blue-500`   | `#0a84ff` | `--blue-600`   | `#007aff` |
| `--green-500`  | `#32d74b` | `--green-600`  | `#28cd41` |
| `--orange-500` | `#ff9f0a` | `--orange-600` | `#ff9500` |
| `--purple-500` | `#bf5af2` | `--purple-600` | `#af52de` |
| `--teal-500`   | `#40c8e0` | `--teal-600`   | `#30b0c7` |
| `--red-500`    | `#ff453a` | `--red-600`    | `#ff3b30` |
| `--yellow-500` | `#ffd60a` | `--yellow-600` | `#c79000` |

Alpha scales for text and lines carry names that approximate opacity. The two
scales aren't symmetric, because each lists exactly the steps the semantic tier consumes:

- White (dark theme): `--white-a90` (90%), `--white-a55` (55%), `--white-a28` (28%),
  `--white-a13` (13%), `--white-a08` (8.5%), `--white-a06` (5.5%)
- Black (light theme): `--black-a88` (88%), `--black-a52` (52%), `--black-a28` (28%),
  `--black-a09` (9%), `--black-a06` (5.5%)

Surface grays:

| Primitive        | Value                    | Role in design            |
| ---------------- | ------------------------ | ------------------------- |
| `--gray-950`     | `#1c1c1e`                | dark content              |
| `--gray-900`     | `#28282c`                | dark toolbar / card       |
| `--gray-850`     | `#2e2e33`                | dark raised box           |
| `--gray-925-a82` | `rgb(30 30 34 / 82%)`    | dark sidebar glass scrim  |
| `--gray-100`     | `#f4f4f6`                | light toolbar             |
| `--gray-50`      | `#f9f9fb`                | light content             |
| `--gray-75-a80`  | `rgb(246 246 250 / 80%)` | light sidebar glass scrim |
| `--white`        | `#ffffff`                | light card / raised       |

### Semantic tokens (`@theme`)

Colors, where every value is `light-dark(<light primitive>, <dark primitive>)`:

| Token                     | Light           | Dark             |
| ------------------------- | --------------- | ---------------- |
| `--color-surface-sidebar` | `--gray-75-a80` | `--gray-925-a82` |
| `--color-surface-toolbar` | `--gray-100`    | `--gray-900`     |
| `--color-surface-content` | `--gray-50`     | `--gray-950`     |
| `--color-surface-card`    | `--white`       | `--gray-900`     |
| `--color-surface-raised`  | `--white`       | `--gray-850`     |
| `--color-ink`             | `--black-a88`   | `--white-a90`    |
| `--color-ink-secondary`   | `--black-a52`   | `--white-a55`    |
| `--color-ink-tertiary`    | `--black-a28`   | `--white-a28`    |
| `--color-line-subtle`     | `--black-a09`   | `--white-a08`    |
| `--color-line-faint`      | `--black-a06`   | `--white-a06`    |
| `--color-line-strong`     | `--black-a28`   | `--white-a13`    |
| `--color-accent`          | `--blue-600`    | `--blue-500`     |
| `--color-success`         | `--green-600`   | `--green-500`    |
| `--color-warning`         | `--orange-600`  | `--orange-500`   |
| `--color-danger`          | `--red-600`     | `--red-500`      |

Teal, purple and yellow ship as primitives only (locked brand palette). Their
semantic consumers (node tints, warnings-vs-caution split) arrive with later features.

Typography, using SF stacks plus role-based sizes (Tailwind `--text-<role>` with
`--font-weight`/`--letter-spacing`/`--line-height` sub-tokens):

| Role         | Size | Weight | Extras                                         |
| ------------ | ---- | ------ | ---------------------------------------------- |
| `title`      | 19px | 600    | tracking −0.4px                                |
| `heading`    | 15px | 600    |                                                |
| `body`       | 13px | 400    | line-height 1.45                               |
| `control`    | 12px | 400    |                                                |
| `caption`    | 11px | 400    |                                                |
| `overline`   | 9px  | 700    | tracking +1.4px; pair with `uppercase` utility |
| `mono-value` | 11px | 400    | used with `font-mono`                          |

- `--font-sans`: `-apple-system, "SF Pro Text", system-ui, sans-serif`
- `--font-mono`: `"SF Mono", ui-monospace, Menlo, monospace`

Radius:

| Token              | Value | Use              |
| ------------------ | ----- | ---------------- |
| `--radius-chip`    | 4px   | pins / chips     |
| `--radius-control` | 6px   | controls / nodes |
| `--radius-card`    | 10px  | cards            |
| `--radius-pill`    | 999px | pills            |

## File structure

```
apps/desktop/src/renderer/src/assets/
  primitives.css   ← :root raw scales; produces no utilities
  theme.css        ← @theme semantic tokens + namespace resets
  main.css         ← @import "tailwindcss" + the two above + app-specific CSS
```

`main.css` retains only what Tailwind can't express: `-webkit-app-region: drag`
regions and the transparent html/body rules the liquid glass window requires.

## Shell restyle

`App.tsx`'s placeholder shell is rewritten with semantic utilities: sidebar
`bg-surface-sidebar` (translucent over glass), content `bg-surface-content`,
text `text-ink` / `text-ink-secondary`, divider `border-line-subtle`, heading `text-title`.
No behavior changes, and the glass window chrome (Architecture Decision Record (ADR) 0008) stays untouched.

## Verification

- `typecheck`, `lint`, `build` green.
- Run the app, then screenshot in dark and in light (macOS appearance toggle). The
  standard theming gap test: if switching themes produces invisible borders or
  vanishing text, a semantic mapping is missing, so fix it before merge.
- No unit tests: foundations are pure CSS with no behavior. The Test-Driven Development (TDD) rule ("test
  code changes iff behavior changes") gates tests on the first behavioral component.

## Records

One ADR (via the `architecture-decision-records` skill) capturing: two-tier tokens,
Tailwind v4 CSS-first, namespace resets, OS-driven theming, no separate UI package,
Claude Design as visual source of truth.
