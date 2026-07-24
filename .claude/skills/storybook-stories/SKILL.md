---
name: storybook-stories
description: Conventions for writing recompose Storybook stories. Use when creating or reviewing any *.stories.tsx file, the Storybook config, or the fake bridge decorator.
---

# Storybook stories

## Placement

- A story lives next to its component: `<component>.stories.tsx` inside the owning slice's `ui/` segment.
- Import other slices only through their public `index.ts`. Steiger enforces this in stories too.
- The pull-request meta-gate fails a new `ui/` component without a story. Escape: `stories-exempt` label plus a `Stories-exempt: <reason>` body line.

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
