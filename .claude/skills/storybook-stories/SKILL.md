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
- One concept per story. Split a story that shows two ideas.
- JSDoc with a purpose sentence goes on every exported component, prop, and story. This is manifest documentation for agents, the one sanctioned exception to the no-comments rule.
- Tag anti-pattern or deprecated stories with `tags: ['!manifest']` so agents never learn from them.

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
