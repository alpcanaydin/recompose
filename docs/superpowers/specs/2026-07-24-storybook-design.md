# Storybook design

Date: 2026-07-24
Status: Approved

## Context

Eighth infrastructure-queue item. The renderer holds six components today, styled through the two-tier Tailwind token architecture from Architecture Decision Record (ADR) 0009. That record already names Storybook as the design system's expected second consumer. Feature-Sliced Design (FSD) boundaries are Steiger-enforced, and component tests run in a real Chromium browser through Vitest with a hand-rolled fake of the `window.recompose` bridge. Chromatic visual regression is queue item 10 and builds on this job. The maintainer locked three choices in the brainstorm. Scope covers infrastructure, seed stories, and a story-required policy. The gate blocks on story tests and accessibility, and Model Context Protocol (MCP) wiring is project scoped.

## Decisions

- **Storybook 10.5 lives in `apps/desktop`** with the `@storybook/react-vite` framework and Component Story Format (CSF) factories. The release line is ECMAScript-module-only, and the repository's Node floor already clears it.
- **`.storybook/main.ts` replicates the renderer's Vite pieces.** Storybook never reads `electron.vite.config.ts`, so `viteFinal` re-declares the `@renderer` alias plus the `react` and `tailwindcss` plugins. The router plugin and the `__CSP__` transform stay out, because Storybook serves its own document.
- **`.storybook/preview.ts` imports `app/styles/main.css`.** The token tiers and `light-dark()` theming arrive with it. `@storybook/addon-themes` drives a light and dark toolbar toggle by flipping `color-scheme` on the preview root.
- **Stories colocate inside their owning slice's `ui/` segment** as `*.stories.tsx`, importing other slices only through public application programming interfaces (APIs). Steiger keeps holding.
- **A global decorator installs a typed fake bridge.** The decorator assigns a `window.recompose` fake typed against the `RecomposeIpc` contract, and stories override scenario data through parameters. The helper lives under `.storybook/` until a second consumer justifies extraction.
- **Six seed stories ship**: `TextField`, `AccountKindField`, `EmptyState`, `AccountList`, `ConnectAccountForm`, and `ProvidersPage`. The wired three render through the fake bridge plus a query-client wrapper.
- **Story discipline follows Storybook's guidance for artificial-intelligence tooling.** One concept per story, JSDoc with `@summary` on components, props, and stories, `react-docgen-typescript` for prop extraction, and anti-pattern stories tagged `!manifest` so automated tooling never learns from them.
- **Story tests become part of the suite.** `@storybook/addon-vitest` adds a third Vitest project that reuses the existing Playwright Chromium provider. Story tests therefore run inside `pnpm test`, the lefthook pre-commit chain, and the required `check` job. Accessibility runs inside those tests with `parameters.a11y.test` set to `error`; a story opts out only with a documented reason.
- **A `storybook build` smoke step joins the `check` job** so a broken configuration or story fails the pull request even when tests pass.
- **The pull-request meta-gate gains a story rule.** A diff adding a new component file under the renderer's `ui/` segments without a sibling `*.stories.tsx` fails. The `stories-exempt` label plus a justification line in the body is the escape hatch, and the weekly bypass audit covers it.
- **MCP wiring is project scoped.** `@storybook/addon-mcp` joins `main.ts` and lives only in the development server, so the packaged app never sees it. A committed `.mcp.json` registers the local endpoint, and the official `@storybook/claude-code-plugin` installs at project scope from the `storybookjs/mcp` marketplace.
- **House conventions land as a project skill.** A small `storybook-stories` skill records FSD placement, CSF factories, JSDoc and manifest discipline, and the fake-bridge decorator pattern. `CLAUDE.md` points at it.
- **Coverage thresholds stay at their current values.** Story tests feed the existing v8 coverage. If a threshold dips during implementation, the fix is finishing stories, never excluding files.

## Testing

- Each seed component gets at least a default story, and every story runs as a browser test through the Vitest addon.
- Accessibility checks run inside those story tests and fail them on violations.
- The `storybook build` smoke proves the configuration compiles.
- The unit-test invariant stays intact: existing specs change only when behavior changes.

## Out of scope

- Chromatic and visual regression baselines: queue item 10.
- A `packages/ui` extraction: FSD demands proven multi-use first, and today's components are page local.
- Mock Service Worker: the renderer talks over the typed bridge, never plain Hypertext Transfer Protocol (HTTP).
- Publishing or hosting the Storybook anywhere.

## Risks

- `@storybook/addon-mcp` and manifests are experimental, and their APIs may change. Both are development-time tools, so product risk stays zero.
- The Vitest addon's coverage interplay gets measured during implementation rather than assumed.
- Fresh Storybook releases may sit under the pnpm release-age floor; exact-version exclusions follow the ADR-0015 pattern.

## Decision record

The team writes ADR-0029 with the architecture-decision-records skill during implementation. It captures the framework choice, the Vite replication constraint, the gate shape, the story policy, and the MCP posture.
