---
name: storybook-stories
description: Conventions for writing recompose Storybook stories. Use when creating or reviewing any *.stories.tsx file, the Storybook config, or the fake bridge decorator.
---

# Storybook stories

## Placement

- A story lives next to its component: `<component>.stories.tsx` inside the owning slice's `ui/` segment.
- Import other slices only through their public `index.ts`. Steiger enforces this in stories too.
- **A play function queries with `findBy`, never `getBy`, whenever the component reads a suspended query.** `getBy` is synchronous, so it throws the moment the story mounts, while the boundary is still pending and the canvas holds no roles at all. The vitest project hides this, because its render flushes React's act queue; Chromatic does not, and reported it as `Unable to find an accessible element` with `There are no accessible roles` against a screenshot that plainly showed the control. Measured: the first role appears about 340 milliseconds in, well inside `findBy`'s one second.
- **An assertion that something is absent needs a settle point before it.** `queryBy(...)).toBeNull()` passes on an empty canvas, so it proves nothing until an `await canvas.findBy...` for something present has run first.
- **A focus assertion waits too.** `findBy` resolves the moment the element exists, which is before the effect that places focus has run: measured at 0 milliseconds focus sits on `body`, and reaches the control around 50. Hold the element in a variable, then assert `toHaveFocus` inside `waitFor`.
- **A story that asserts the scheme wraps the read in `waitFor` with a timeout past one second.** The theme decorator lands late: measured against the static build, `body` reads `light dark` at 0 milliseconds and only settles on `dark` around 1200, which is past `waitFor`'s default. A bare synchronous read fails, and a `waitFor` left on its default fails too.
- **A new `ui/` component and its story land in the same commit.** Writing the component without the story is the mistake this rule exists to stop, and it stays cheap only while both files are still open.
- Two gates enforce it. `pnpm run lint:stories` runs on `pre-push` and names each component missing its sibling, so the branch never reaches a pull request with the gap. The pull-request meta-gate runs the same script against the pull request's base. Escape: `stories-exempt` label plus a `Stories-exempt: <reason>` body line, and the escape only exists on the pull request.

## Format

- Component Story Format (CSF) factories only: `import preview from '#.storybook/preview'`, then `preview.meta({ component })` and `meta.story({ args })`.
- One concept per story. Split a story that shows two ideas. A `SizesAndVariants` story mixing many concepts is the documented anti-pattern; `Basic`, `Primary`, `Disabled` is the documented good shape.

## Manifest documentation

Agents consume stories through manifests built by static analysis (source: [Storybook AI best practices](https://storybook.js.org/docs/ai/best-practices) and [manifests](https://storybook.js.org/docs/ai/manifests)):

- JSDoc with a purpose sentence goes on every exported component, prop, and story. This is manifest documentation for agents, the one sanctioned exception to the no-comments rule.
- Describe the why, not the what: when to reach for the component or variant, never how it renders.
- Agents read a component's `@summary` tag, or a truncated description when no summary exists. A story surfaces roughly its first sixty characters, so front-load the point; add `@summary` when a description runs long.
- Prop tables come from docgen. This repo pins `reactDocgen: 'react-docgen'` (the TypeScript-aware extractor crashes against the TypeScript 7 compiler), so hand-written prop JSDoc carries more weight here than upstream docs assume.
- Curate, never dump: irrelevant manifest content degrades agent output as surely as missing content. Tag anti-pattern or deprecated stories with `tags: ['!manifest']` on the story, on the meta (whole file), or on an MDX `Meta` tag.
- Manifests capture only what static analysis sees. A dynamically computed value never lands in them, so write key values literally in MDX docs pages.
- Sanity-check what agents see at `/manifests/components.json` and the human-readable `/manifests/components.html` while `storybook dev` runs.

## Wired components

- Components touching TanStack Query or the bridge render through the global `withRecomposeBridge` decorator automatically.
- Scenario data goes through parameters: `parameters: { bridge: { accounts, overrides } }` where `overrides` is a `Partial<RecomposeIpc>`.
- Never talk to the real bridge or network in a story.

## Accessibility

- Story tests run axe with `parameters.a11y.test: 'error'`. Fix the component, not the gate.
- A story-level opt-out (`parameters: { a11y: { test: 'off' } }`) needs the reason in the story's JSDoc.

## Verification

- `pnpm --filter @recompose/desktop exec vitest run --project storybook` runs every story as a browser test.
- `pnpm --filter @recompose/desktop run storybook` serves the workshop on port 6006, with the MCP endpoint at `/mcp`.

### Look at it, every time

**Any change that reaches the screen gets opened in the browser through claude-in-chrome, in both schemes, before it lands.** That covers a component, a story, a design token, and the Storybook config. Load the affected stories at `http://localhost:6006/iframe.html?id=<story-id>&globals=theme:light` and again with `theme:dark`.

This isn't ceremony. On the run that wrote this rule every gate was green, axe included, while all of the following shipped:

- The dark scheme rendered light. The theme class reached the root element, and the app stylesheet gave `body` its own `color-scheme`, which beats what it inherits.
- A row printed its label twice, because one control named itself visibly while its three siblings used `aria-label`.
- An inert row looked identical to a live one, since only its control carried the state.
- A selected segment sat at 1.05 to 1 against its track, carried by a shadow alone.
- Every group story rendered at 1654 pixels, three times the width the layout contract fixes, so nobody had seen the real proportions.

Axe passed all five, because each one is a fact about appearance rather than about semantics. A suite that never looks can't catch them.

**Measure the close calls rather than squinting.** Read computed style straight from the page, and compute the ratio when a state indicator or a muted ink is in question. Three of those five were only provable by number, and one of them looked fine in a screenshot.
