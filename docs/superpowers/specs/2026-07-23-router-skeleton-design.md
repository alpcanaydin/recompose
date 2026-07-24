# Router skeleton: Design

Date: 2026-07-23
Status: Approved

## Context

Fifth infrastructure-queue item. The renderer is a single placeholder component. The product needs screen structure: a persistent sidebar beside a routed main area (gateway canvas per gateway, providers screen, empty state). The queue planning chose TanStack Router for its end-to-end type safety and first-class search params. The latter will carry drawer/inspector state in later feature work. Scope is user-locked to the skeleton: routing infrastructure plus placeholder pages. The real sidebar UI is a separate design-system feature job.

## Decisions

- **Packages (exact pins):** `@tanstack/react-router` 1.170.18; dev-only `@tanstack/router-plugin` 1.168.23 and `@tanstack/react-router-devtools` 1.167.0.
- **File-based routing, routed through the Feature-Sliced Design (FSD) app layer.** The router plugin's `routesDirectory` points at `src/renderer/src/app/routes/`, since FSD assigns routing to the app layer, and Steiger accepts app-layer segments, so the framework directory lives inside the architecture instead of beside it. Route files are thin `createFileRoute` adapters. Screen components live in `pages/` slices (the FSD framework-integration pattern). The plugin registers BEFORE the react plugin in `electron.vite.config.ts`.
- **Route set v1:** `__root.tsx` (sidebar + `Outlet`, replacing today's `app.tsx` layout), `index.tsx` (empty state: no gateway selected), `gateways.$slug.tsx` (canvas placeholder), `providers.tsx` (providers placeholder).
- **First real `pages/` slices:** `pages/gateway-canvas/` and `pages/providers/`, each `ui/` segment + `index.ts` public API, placeholder content matching the current shell's styling.
- **Type discipline:** router type registered via `declare module '@tanstack/react-router'`. `$slug` parses with `gatewaySlugSchema` from `@recompose/contracts` (invalid slug → `notFound()`). Any future route search params must be zod-validated via `validateSearch`, recorded as a standing rule in Architecture Decision Record (ADR) ADR-0017.
- **Loaders are absent.** Renderer data arrives with the typed Inter-Process Communication (IPC) queue item. Routes ship without loaders rather than with stubs.
- **Devtools:** `@tanstack/react-router-devtools` mounted in `__root` only when `import.meta.env.DEV`, lazy-imported so production bundles exclude it.

## Generated-file policy

The router plugin generates `src/renderer/src/app/routeTree.gen.ts` and treats it like a lockfile: excluded from oxlint, oxfmt, coverage, and knip. It's exempt from the no-comments rule (generated code). It stays in the dependency-cruiser graph because its import chain is real. The file stays committed to the repo, since CI doesn't run codegen.

## Testing (browser mode, real Chromium)

Navigation behavior specs run on a memory-history router:

- The shell renders the sidebar and the empty state at `/`.
- Activating the providers link navigates to `/providers` and shows the providers page.
- `/gateways/<valid-slug>` shows the canvas placeholder for that slug.
- `/gateways/INVALID!` (fails `gatewaySlugSchema`) renders the not-found state.

These specs cover route adapters and pages. The coverage gate (≥90 shared thresholds) holds with `routeTree.gen.ts` excluded.

## Out of scope / deferred

- Real sidebar UI (gateway list, DS styling, active states): separate feature job through the design-system/Mobbin process.
- Usage/inspector drawers and their search-param state: feature jobs; this spec only fixes the rule that such state is zod-validated.
- Route loaders, router context wiring (queryClient/IPC): the typed-IPC queue item.
- `@tanstack/intent`: the official skill channel ships nothing for the router package today; revisit when it does (community `tanstack-router` skill serves meanwhile).

## Decision record

Recorded as ADR-0017 via the `architecture-decision-records` skill during implementation (file-based routing inside the FSD app layer, generated-file policy, search-param validation rule). CLAUDE.md gains the rule that TanStack Router work loads the `tanstack-router` skill.
