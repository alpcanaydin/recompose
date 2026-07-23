# Router Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** File-based TanStack Router inside the FSD app layer — root layout with sidebar links, empty-state index, slug-validated gateway canvas route, providers route — proven by Browser Mode navigation specs.

**Architecture:** The router plugin generates the route tree from `src/renderer/src/app/routes/` (routing is an app-layer segment per FSD). Route files are thin `createFileRoute` adapters; screens live in `pages/` slices behind public APIs. A `createAppRouter(history?)` factory in the app layer serves both the real entry (browser history) and tests (memory history). `routeTree.gen.ts` is generated, committed, and treated like a lockfile by every gate.

**Tech Stack:** @tanstack/react-router 1.170.18, @tanstack/router-plugin 1.168.23, @tanstack/react-router-devtools 1.167.0, zod slug rule from @recompose/contracts.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-23-router-skeleton-design.md`.
- Exact pins: `@tanstack/react-router` 1.170.18 as a runtime dependency of apps/desktop; `@tanstack/router-plugin` 1.168.23 and `@tanstack/react-router-devtools` 1.167.0 as devDependencies (`pnpm add -E` / `-D -E`).
- FSD placement is binding and machine-checked (Steiger in pre-commit): route adapters in `app/routes/`, router factory `app/router.tsx`, screens ONLY in `pages/<slice>/ui/` re-exported through `pages/<slice>/index.ts`; route files import pages ONLY via the slice public API.
- `src/renderer/src/app/routeTree.gen.ts` is generated: excluded from oxlint, oxfmt, knip, and coverage; committed to git; exempt from the no-comments rule. Hand-editing it is forbidden.
- `$slug` is parsed with `gatewaySlugSchema` from `@recompose/contracts`; an invalid slug must land on the not-found UI.
- No route loaders, no router context values in this job (typed-IPC queue item owns them).
- Devtools render only in dev — never in production builds and never in vitest runs.
- Browser-mode tests (`*.browser.test.tsx`) drive a memory-history router; node tests are not applicable here.
- TypeScript max strictness; no `any`, no silencing `as`. **Never write code comments** (generated file exempt).
- The repository owner's private alias must not appear in any artifact.
- Commit messages: Conventional Commits, terse, imperative; trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Pre-commit hooks run gitleaks/lint/fmt/typecheck + boundaries/fsd/dead; oxfmt may reformat and auto-stage. If the FIRST commit in a fresh worktree fails with `oxfmt: No such file or directory`, run `pnpm install` once and retry.
- All commands run from the worktree root. Shell may be fish: `echo "exit: $status"`, never after a pipe.

---

### Task 1: Router foundation — plugin, factory, root layout, empty state

**Files:**

- Modify: `apps/desktop/package.json` (dependencies + devDependencies)
- Modify: `apps/desktop/electron.vite.config.ts` (renderer plugins)
- Create: `apps/desktop/src/renderer/src/app/routes/__root.tsx`
- Create: `apps/desktop/src/renderer/src/app/routes/index.tsx`
- Create: `apps/desktop/src/renderer/src/app/router.tsx`
- Modify: `apps/desktop/src/renderer/src/app/main.tsx`
- Delete: `apps/desktop/src/renderer/src/app/app.tsx`
- Delete: `apps/desktop/src/renderer/src/app/app.browser.test.tsx`
- Create (generated): `apps/desktop/src/renderer/src/app/routeTree.gen.ts`
- Test: `apps/desktop/src/renderer/src/app/router.browser.test.tsx`
- Modify: `.oxlintrc.json`, `.oxfmtrc.json` (ignore the generated file)
- Modify: `apps/desktop/vitest.config.ts` (coverage exclude for the generated file)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `createAppRouter(history?: RouterHistory)` exported from `apps/desktop/src/renderer/src/app/router.tsx` (registered router type via `declare module`); the `__root` layout markup (sidebar `<aside>` with nav links + `<main>` with `Outlet`); Task 2 adds route files under the same `app/routes/` and page slices the adapters import.

- [ ] **Step 1: Install packages**

```bash
pnpm --filter @recompose/desktop add -E @tanstack/react-router@1.170.18
pnpm --filter @recompose/desktop add -D -E @tanstack/router-plugin@1.168.23 @tanstack/react-router-devtools@1.167.0
```

- [ ] **Step 2: Wire the Vite plugin (before react, renderer only)**

Replace `apps/desktop/electron.vite.config.ts` with:

```ts
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import { resolve } from 'path';

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
      },
    },
    plugins: [
      tanstackRouter({
        target: 'react',
        routesDirectory: './src/app/routes',
        generatedRouteTree: './src/app/routeTree.gen.ts',
      }),
      react(),
      tailwindcss(),
    ],
  },
});
```

The renderer's Vite root is `src/renderer`, so both paths resolve inside `src/renderer/src/app/`. Verify after Step 5's first build/dev run that `apps/desktop/src/renderer/src/app/routeTree.gen.ts` is where the file appears — if the plugin writes it elsewhere, fix the two paths, never move the file by hand.

- [ ] **Step 3: Create the root layout and empty state**

Create `apps/desktop/src/renderer/src/app/routes/__root.tsx` (the markup is today's `app.tsx` shell with links added, unchanged styling):

```tsx
import { Link, Outlet, createRootRoute } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  return (
    <div className="flex h-full">
      <aside className="app-drag w-60 bg-surface-sidebar px-4 pt-13 pb-4 text-body text-ink-secondary">
        <nav className="flex flex-col gap-2">
          <Link to="/">Gateways</Link>
          <Link to="/providers">Providers</Link>
        </nav>
      </aside>
      <main className="flex-1 bg-surface-content px-6 pt-13 pb-6 text-body">
        <Outlet />
      </main>
    </div>
  );
}

function NotFound() {
  return <p>Not found</p>;
}
```

Create `apps/desktop/src/renderer/src/app/routes/index.tsx` (empty state is app chrome, not a screen — it stays inline by design):

```tsx
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: EmptyState,
});

function EmptyState() {
  return <p>Select a gateway or create one to get started.</p>;
}
```

- [ ] **Step 4: Create the router factory and rewire the entry**

Create `apps/desktop/src/renderer/src/app/router.tsx`:

```tsx
import { createRouter, type RouterHistory } from '@tanstack/react-router';

import { routeTree } from './routeTree.gen';

export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    ...(history === undefined ? {} : { history }),
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
```

Replace `apps/desktop/src/renderer/src/app/main.tsx` with:

```tsx
import './styles/main.css';

import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { createAppRouter } from './router';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={createAppRouter()} />
  </StrictMode>,
);
```

Delete `apps/desktop/src/renderer/src/app/app.tsx` and `apps/desktop/src/renderer/src/app/app.browser.test.tsx` (the shell's behavior moves to `__root` and is re-specified by the navigation tests in Step 7 — behavior changed, so the tests change with it).

- [ ] **Step 5: Generate the route tree**

Run: `pnpm --filter @recompose/desktop run build`
Expected: build succeeds AND `apps/desktop/src/renderer/src/app/routeTree.gen.ts` now exists (generated during the vite run). It will contain comments — that is the sanctioned generated-file exemption.

- [ ] **Step 6: Exempt the generated file from the gates**

In `.oxlintrc.json`, append to `ignorePatterns`: `"**/routeTree.gen.ts"`.
In `.oxfmtrc.json`, append to `ignorePatterns`: `"**/routeTree.gen.ts"`.
In `apps/desktop/vitest.config.ts`, append to the `coverage.exclude` array: `'src/renderer/src/app/routeTree.gen.ts',`.
If `pnpm run lint:dead` flags the generated file or the router packages, add the narrowest possible knip entry and record it in your report — never a broad ignore.

- [ ] **Step 7: Write the failing navigation specs**

Create `apps/desktop/src/renderer/src/app/router.browser.test.tsx`:

```tsx
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { createAppRouter } from './router';

function renderAt(path: string) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  return render(<RouterProvider router={router} />);
}

test('the shell shows the sidebar and the empty state at the root', async () => {
  const screen = renderAt('/');

  await expect.element(screen.getByRole('link', { name: 'Gateways' })).toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'Providers' })).toBeVisible();
  await expect
    .element(screen.getByText('Select a gateway or create one to get started.'))
    .toBeVisible();
});

test('an unknown path shows the not-found state inside the shell', async () => {
  const screen = renderAt('/no-such-page');

  await expect.element(screen.getByText('Not found')).toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'Providers' })).toBeVisible();
});
```

- [ ] **Step 8: Run to verify the RED, then the GREEN**

Run: `pnpm --filter @recompose/desktop run test`
Expected first: FAIL while any wiring is incomplete (e.g. before Steps 3–6 are all done, module resolution or route-tree errors). Once Steps 1–6 are complete, re-run:
Expected: PASS — browser project runs both navigation specs in Chromium; unit project (window-options) untouched; coverage gate green (`app.tsx` is gone; `router.tsx`, `__root.tsx`, `index.tsx` are covered by the specs; `main.tsx` and `routeTree.gen.ts` excluded).

- [ ] **Step 9: Full gates and commit**

Run: `pnpm --filter @recompose/desktop run typecheck && pnpm run lint:boundaries && pnpm run lint:fsd && pnpm run lint:dead && pnpm run fmt:check`
Expected: all exit 0 — Steiger must accept `app/routes/` and `router.tsx` as app-layer segments without any rule disables; if it objects, STOP and report BLOCKED with the diagnostic.

```bash
git add apps/desktop .oxlintrc.json .oxfmtrc.json pnpm-lock.yaml
git commit -m "feat(desktop): tanstack router foundation in fsd app layer"
```

---

### Task 2: Screen routes — pages slices, slug-validated canvas, providers

**Files:**

- Create: `apps/desktop/src/renderer/src/pages/gateway-canvas/ui/gateway-canvas-page.tsx`
- Create: `apps/desktop/src/renderer/src/pages/gateway-canvas/index.ts`
- Create: `apps/desktop/src/renderer/src/pages/providers/ui/providers-page.tsx`
- Create: `apps/desktop/src/renderer/src/pages/providers/index.ts`
- Create: `apps/desktop/src/renderer/src/app/routes/gateways.$slug.tsx`
- Create: `apps/desktop/src/renderer/src/app/routes/providers.tsx`
- Test: extend `apps/desktop/src/renderer/src/app/router.browser.test.tsx`

**Interfaces:**

- Consumes: `createAppRouter` and the test harness from Task 1; `gatewaySlugSchema` from `@recompose/contracts`.
- Produces: `GatewayCanvasPage({ slug }: { slug: string })` from `pages/gateway-canvas`; `ProvidersPage()` from `pages/providers`; route ids `/gateways/$slug` and `/providers` that later feature jobs extend.

- [ ] **Step 1: Write the failing navigation specs**

Append to `apps/desktop/src/renderer/src/app/router.browser.test.tsx`:

```tsx
test('clicking the providers link navigates to the providers screen', async () => {
  const screen = renderAt('/');

  await screen.getByRole('link', { name: 'Providers' }).click();

  await expect.element(screen.getByRole('heading', { name: 'Providers' })).toBeVisible();
});

test('a valid gateway slug shows the canvas placeholder for that gateway', async () => {
  const screen = renderAt('/gateways/my-gateway');

  await expect.element(screen.getByRole('heading', { name: 'my-gateway' })).toBeVisible();
  await expect.element(screen.getByText('Canvas coming soon.')).toBeVisible();
});

test('an invalid gateway slug lands on the not-found state', async () => {
  const screen = renderAt('/gateways/Not%20A%20Slug');

  await expect.element(screen.getByText('Not found')).toBeVisible();
});
```

Run: `pnpm --filter @recompose/desktop run test`
Expected: FAIL — the three new specs cannot resolve the routes.

- [ ] **Step 2: Create the pages slices**

Create `apps/desktop/src/renderer/src/pages/gateway-canvas/ui/gateway-canvas-page.tsx`:

```tsx
export function GatewayCanvasPage({ slug }: { slug: string }) {
  return (
    <section>
      <h1 className="text-ink-secondary">{slug}</h1>
      <p>Canvas coming soon.</p>
    </section>
  );
}
```

Create `apps/desktop/src/renderer/src/pages/gateway-canvas/index.ts`:

```ts
export { GatewayCanvasPage } from './ui/gateway-canvas-page';
```

Create `apps/desktop/src/renderer/src/pages/providers/ui/providers-page.tsx`:

```tsx
export function ProvidersPage() {
  return (
    <section>
      <h1 className="text-ink-secondary">Providers</h1>
      <p>Connect a provider to get started.</p>
    </section>
  );
}
```

Create `apps/desktop/src/renderer/src/pages/providers/index.ts`:

```ts
export { ProvidersPage } from './ui/providers-page';
```

- [ ] **Step 3: Create the route adapters**

Create `apps/desktop/src/renderer/src/app/routes/gateways.$slug.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { gatewaySlugSchema } from '@recompose/contracts';

import { GatewayCanvasPage } from '../../pages/gateway-canvas';

export const Route = createFileRoute('/gateways/$slug')({
  params: {
    parse: (params) => ({ slug: gatewaySlugSchema.parse(params.slug) }),
    stringify: (params) => params,
  },
  component: GatewayCanvasRoute,
});

function GatewayCanvasRoute() {
  const { slug } = Route.useParams();
  return <GatewayCanvasPage slug={slug} />;
}
```

Create `apps/desktop/src/renderer/src/app/routes/providers.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';

import { ProvidersPage } from '../../pages/providers';

export const Route = createFileRoute('/providers')({
  component: ProvidersPage,
});
```

- [ ] **Step 4: Regenerate the tree and verify GREEN**

Run: `pnpm --filter @recompose/desktop run build`
Expected: `routeTree.gen.ts` updates with the two new routes.

Run: `pnpm --filter @recompose/desktop run test`
Expected: PASS — all five navigation specs plus the unit project; coverage gate green (pages and adapters covered by the specs).

If the invalid-slug spec fails because a `params.parse` throw surfaces as an error boundary instead of not-found, check the installed TanStack Router docs (`node_modules/@tanstack/react-router`) for the current invalid-params behavior and route the failure to `notFound()` explicitly (e.g. catch the parse error in a `beforeLoad` and `throw notFound()`), keeping the schema as the single validation source. Report which mechanism the shipped version required.

- [ ] **Step 5: Full gates and commit**

Run: `pnpm --filter @recompose/desktop run typecheck && pnpm run lint:boundaries && pnpm run lint:fsd && pnpm run lint:dead && pnpm run fmt:check`
Expected: all exit 0 — Steiger validates the first `pages/` slices (public API rule included).

```bash
git add apps/desktop
git commit -m "feat(desktop): gateway canvas and providers routes over pages slices"
```

---

### Task 3: Devtools (dev-only) + boot smoke + CLAUDE.md rule

**Files:**

- Modify: `apps/desktop/src/renderer/src/app/routes/__root.tsx`
- Modify: `CLAUDE.md` (frontend skills section)

**Interfaces:**

- Consumes: `__root.tsx` from Task 1.
- Produces: dev-only devtools mount; the standing CLAUDE.md rule.

- [ ] **Step 1: Mount devtools dev-only, vitest-excluded**

In `apps/desktop/src/renderer/src/app/routes/__root.tsx`, add imports:

```tsx
import { Suspense, lazy } from 'react';
```

above the component definitions add:

```tsx
const RouterDevtools =
  import.meta.env.DEV && import.meta.env.MODE !== 'test'
    ? lazy(() =>
        import('@tanstack/react-router-devtools').then((module) => ({
          default: module.TanStackRouterDevtools,
        })),
      )
    : () => null;
```

and inside `RootLayout`'s returned JSX, after `</main>` (still inside the flex container's parent div):

```tsx
<Suspense>
  <RouterDevtools />
</Suspense>
```

Run: `pnpm --filter @recompose/desktop run test`
Expected: PASS unchanged — vitest sets `MODE === 'test'`, so the null component renders and no devtools chunk loads in specs. If `import.meta.env.MODE` is not `'test'` under the browser project, verify with a temporary `console.log` (removed before commit) and gate on the env var vitest actually sets (report which).

- [ ] **Step 2: Boot smoke — build green is not boot proof**

```bash
pnpm --filter @recompose/desktop run build
(pnpm --filter @recompose/desktop run start > /tmp/recompose-router-smoke.log 2>&1 &) ; sleep 15
grep -iE "error|cannot find|failed" /tmp/recompose-router-smoke.log && echo "BOOT PROBLEM" || echo "boot clean"
pkill -f "electron-vite preview" ; pkill -f "recompose.*Electron" 2>/dev/null
```

Expected: `boot clean`, and an Electron window came up during those seconds (the storage job's lesson: a green build once shipped an unbootable app). Paste the grep result in your report.

- [ ] **Step 3: Add the CLAUDE.md rule**

In `CLAUDE.md`, in the `## Frontend (renderer) skills` section, add after the `feature-sliced-design` bullet:

```markdown
- `tanstack-router` — before any TanStack Router work (routes, navigation, search params): file-based conventions, loader discipline, type registration. `tanstack-devtools` when wiring devtools.
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/renderer/src/app/routes/__root.tsx CLAUDE.md
git commit -m "feat(desktop): dev-only router devtools, skill routing rule"
```

---

### Task 4: ADR-0017

**Files:**

- Create: `docs/adr/0017-tanstack-router-file-based-in-app-layer.md`
- Modify: `docs/adr/README.md` (index row after 0016)

**Interfaces:**

- Consumes: shipped routing from Tasks 1–3 (referenced, not changed).
- Produces: the decision record; nothing downstream.

- [ ] **Step 1: Write the ADR**

Create `docs/adr/0017-tanstack-router-file-based-in-app-layer.md`:

```markdown
# ADR-0017: TanStack Router, File-Based, Inside the FSD App Layer

**Status**: Accepted
**Date**: 2026-07-23

## Context

The renderer needed screen structure: a persistent sidebar beside routed content (gateway canvas per gateway, providers, empty state), with drawer/inspector state arriving in later feature work. The queue chose TanStack Router for end-to-end type safety and first-class search params. Two constraints shaped the integration: the renderer is FSD v2.1 with Steiger enforcing layer rules, and the repo's no-comments/coverage/dead-code gates must treat generated code sanely.

## Decision

- **File-based routing with the router plugin's directory pointed INSIDE the FSD app layer** (`src/app/routes/`): FSD assigns routing to app, so the framework directory lives in the architecture instead of beside it. Route files are thin `createFileRoute` adapters; screens live in `pages/` slices behind public APIs (the framework-integration pattern). The plugin registers before the react plugin.
- **A `createAppRouter(history?)` factory** serves the real entry (default browser history) and Browser Mode tests (memory history); the router type registers via `declare module` off the factory's return type.
- **`$slug` params parse through `gatewaySlugSchema` from `@recompose/contracts`** — one slug rule across disk, schema, and URL; invalid slugs land on not-found. Standing rule: any future route search params are zod-validated via `validateSearch`.
- **Generated-file policy**: `routeTree.gen.ts` is committed and treated like a lockfile — excluded from oxlint/oxfmt/knip/coverage, exempt from the no-comments rule, present in the dependency-cruiser graph (its import chain is real).
- **Loaders and router context deliberately absent** until the typed-IPC queue item; devtools mount dev-only (never in production bundles or vitest runs).

## Alternatives

- **Code-based route tree**: no codegen artifacts, but loses the file-convention discipline and route-level type inference the file-based mode generates; the skill and upstream docs both steer file-based for applications.
- **Routes directory outside the FSD root** (`src/routes/`): keeps codegen away from FSD, but Steiger then polices a tree that no longer contains the routing reality, and every route file needs a lint exemption — the architecture should contain the framework, not exempt it.
- **React Router**: mature, but search params and loader typing are exactly the product's future needs (drawer state, canvas selection), where TanStack's model is stronger.

## Consequences

**Good**: navigation is type-checked end to end (bad links fail typecheck); the slug rule cannot drift between storage and URLs; tests drive real Chromium navigation through the same factory the app boots with; later feature jobs add screens by dropping a route adapter plus a pages slice — a shape Steiger already enforces.

**Bad**: a generated, committed artifact rides every route change (reviewers skim it, never edit it); four gate configs carry an exemption for it; `@tanstack/intent` ships no router skill yet, so skill guidance comes from a community pack until upstream catches up.
```

- [ ] **Step 2: Add the index row**

In `docs/adr/README.md`, append after the 0016 row:

```markdown
| [0017](0017-tanstack-router-file-based-in-app-layer.md) | TanStack Router, File-Based, Inside the FSD App Layer | Accepted | 2026-07-23 |
```

- [ ] **Step 3: Commit**

```bash
git add docs/adr
git commit -m "docs(adr): record router integration (ADR-0017)"
```
