# 0017: TanStack, file-based routing inside the feature-sliced app layer

**Status**: Accepted
**Date**: 2026-07-23

## Context

The renderer needed screen structure: a persistent sidebar beside routed content (gateway canvas per gateway, providers, empty state), with drawer/inspector state arriving in later feature work. The queue chose TanStack Router for end-to-end type safety and first-class search params. Two constraints shaped the integration. The renderer follows Feature-Sliced Design (FSD) v2.1 with Steiger enforcing layer rules, and the repo's no-comments/coverage/dead-code gates must treat generated code sanely.

## Decision

- **File-based routing with the router plugin's directory pointed INSIDE the FSD app layer** (`src/app/routes/`): FSD assigns routing to app, so the framework directory lives in the architecture instead of beside it. Route files are thin `createFileRoute` adapters; screens live in `pages/` slices behind public APIs (the framework-integration pattern). The plugin registers before the react plugin.
- **A `createAppRouter(history?)` factory** serves the real entry (default browser history) and Browser Mode tests (memory history); the router type registers via `declare module` off the factory's return type.
- **`$slug` params parse through `gatewaySlugSchema` from `@recompose/contracts`**, keeping one slug rule across disk, schema, and URL. Invalid slugs land on not-found via `safeParse` plus an explicit `throw notFound()` inside `params.parse`, because a raw schema throw surfaces as the router's error boundary instead. Standing rule: any future route search params are zod-validated via `validateSearch`.
- **Generated-file policy**: the repo commits and treats `routeTree.gen.ts` like a lockfile: excluded from oxlint/oxfmt/knip/coverage, exempt from the no-comments rule, present in the dependency-cruiser graph (its import chain is real).
- **Loaders and router context stay absent by design** until the typed Inter-Process Communication (IPC) queue item; devtools mount dev-only (never in production bundles or vitest runs).

## Alternatives

- **Code-based route tree**: no codegen artifacts, but loses the file-convention discipline and route-level type inference the file-based mode generates; the skill and upstream docs both steer file-based for applications.
- **Routes directory outside the FSD root** (`src/routes/`): keeps codegen away from FSD, but Steiger then polices a tree that no longer contains the routing reality, and every route file needs a lint exemption. The architecture should contain the framework, not exempt it.
- **React Router**: mature, but search params and loader typing are exactly the product's future needs (drawer state, canvas selection), where TanStack's model is stronger.

## Consequences

**Good**: navigation is type-checked end to end (bad links fail typecheck). The slug rule can't drift between storage and URLs. Tests drive real Chromium navigation through the same factory the app boots with. Later feature jobs add screens by dropping a route adapter plus a pages slice, a shape Steiger already enforces.

**Bad**: a generated, committed artifact rides every route change (reviewers skim it, never edit it). Four gate configs carry an exemption for it. `@tanstack/intent` ships no router skill yet, so skill guidance comes from a community pack until upstream catches up.
