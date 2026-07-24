# Folder structure: Design

**Date:** 2026-07-22
**Status:** Approved. Implemented via `docs/superpowers/plans/2026-07-22-folder-structure.md` (Architecture Decision Record (ADR) 0010)

## Goal

Fix the repository's folder structure before feature development starts, at every level: monorepo package map, Electron process layout (`main`/`preload`/`renderer`), and renderer internals. Every placement question must have a pre-written answer, and every rule must be machine-enforced, leaving no room for session-to-session interpretation drift.

## Guiding decision

Two published conventions, one tool each, zero overlap:

- **Renderer:** full [Feature-Sliced Design](https://feature-sliced.design/) (FSD), enforced by [Steiger](https://github.com/feature-sliced/steiger). This spec picks FSD over a bespoke hybrid, because it's an externally documented standard: the methodology answers "where does this file go," instead of whoever (or whatever) is writing code that day.
- **Repo graph:** [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) enforces everything FSD can't see: package direction, Electron process boundaries, the engine's purity rule, and circular-import bans.

## 1. Monorepo map

```text
apps/
├─ desktop/            # Electron app — exists today; the gateway server is spawned from here
└─ headless/           # reserved, may never open — CLI mode ("recompose serve")
packages/
├─ engine/             # reserved — pure-TS gateway engine (ADR-0002); opens with its first real code
└─ contracts/          # reserved — domain types + zod schemas: the IPC and engine message contract
design-system/         # Claude Design library (exists, unchanged)
docs/adr/              # exists, unchanged
```

This spec names reserved packages now, so their boundary rules exist before their first file does. This follows the You Aren't Gonna Need It (YAGNI) principle: no empty scaffolds. A package opens only when its first real code lands, and `packages/engine` gets its own internal-structure ADR at that moment. Its shape depends on which OSS gateway code gets adapted, so designing it earlier would be speculation.

**Dependency direction (target state, with machine enforcement landing via the deferred dependency-cruiser/Steiger queue item):**

- `apps/desktop` → `packages/contracts` ← `packages/engine`
- `packages/engine` must never import `electron` or any workspace package other than `contracts` (regular npm dependencies are fine)
- `apps/desktop` and `packages/engine` must never import each other
- `apps/headless` (if it ever opens) → `packages/engine` + `packages/contracts` only
- No circular imports anywhere in the repo

## 2. Electron process layout (`apps/desktop/src`)

```text
src/
├─ main/
│  ├─ index.ts          # bootstrap only: app lifecycle, composition, ordering
│  ├─ windows/          # BrowserWindow setup, liquid glass, traffic lights
│  ├─ ipc/              # ipcMain handlers — zod-validated at the boundary (queue item 6 lands here)
│  └─ engine-host/      # utilityProcess spawn/monitoring + the engine entry file
│                       #   (electron-vite builds the entry as an extra input;
│                       #    the running gateway server is a child of main — ADR-0002)
├─ preload/
│  └─ index.ts          # contextBridge: narrow typed surface, deliberately a single file —
│                       #   if it wants to grow, the exposed API surface is too wide
└─ renderer/            # section 3
```

**Process-boundary rules (dependency-cruiser):**

- `renderer` must never import from `main` or `preload` (and vice versa), since they communicate only via Inter-Process Communication (IPC)
- `main`/`preload` must never import from `renderer`
- Only `engine-host` may reference the engine entry

## 3. Renderer layer structure

Root: `src/renderer/src/`. Standard FSD layers, no custom layers:

```text
app/          # providers, router setup, global styles
│  └─ routes/  # TanStack Router file-based route files — thin, delegate to pages
pages/        # one slice per screen/surface: gateway-canvas, providers, settings, …
widgets/      # self-sufficient page blocks: sidebar, toolbar, bottom-log-panel, inspector-drawer
features/     # user actions: wire-virtual-model, start-stop-gateway, connect-provider, …
entities/     # domain objects: gateway, virtual-model, router-node, provider, target
shared/       # ui kit (DS primitives), ipc client, config — no business logic
```

Layer import rule (enforced by Steiger): a layer may import only from layers **below** it (`app` → `pages` → `widgets` → `features` → `entities` → `shared`). Slices on the same layer never import each other.

**Segments** inside every slice: purpose-named, never essence-named. This spec forbids `components/`, `hooks/`, `types/`, `utils/` as folder names:

```text
entities/gateway/
├─ ui/       # components + hooks
├─ model/    # state, schemas, behavior
├─ api/      # IPC calls toward main
└─ lib/      # slice-local library code (rare)
```

A segment opens when its first file lands. Each slice exposes a public API `index.ts`, and Steiger blocks deeper imports. Segment-level barrel files aren't used (Vite tree-shaking).

**Placement rule (FSD v2.1's `start simple, extract when needed`):** New code goes into the `pages/` slice it serves. It moves down a layer only when the same code is _currently_ used in 2+ places and the usages don't always change together, and only when the boundary is stable. Hypothetical reuse never justifies the move. The minimal valid tree is `app/ + pages/ + shared/`. `widgets/`, `features/`, `entities/` open at their first confirmed multi-use, like every other folder in this spec.

| It's a…                                                                                                    | It goes to         |
| ---------------------------------------------------------------------------------------------------------- | ------------------ |
| anything single-use, or in doubt                                                                           | its `pages/` slice |
| domain model used by 2+ pages/widgets **today**                                                            | `entities/`        |
| user interaction used by 2+ pages/widgets **today**                                                        | `features/`        |
| composite block reused across pages **today**                                                              | `widgets/`         |
| infrastructure with zero business logic (ui kit, IPC client, Create, Read, Update, Delete (CRUD) plumbing) | `shared/`          |

`shared/` exposes a public API per segment (`shared/ui/index.ts`, `shared/api/index.ts`), with no top-level `shared/index.ts`. Every placement decision for a new renderer file goes through the `feature-sliced-design` skill's decision tree (rule recorded in `CLAUDE.md`).

**TanStack Router fit:** file-based route files live in `app/routes/`, and each route file only mounts a `pages/` slice. This is the documented FSD + TanStack combination. If the route-file location fights the router's generator, TanStack's Virtual File Routes are the sanctioned escape hatch.

## 4. Tests

- Unit/integration: colocated, with `wire-status.ts` + `wire-status.test.ts` side by side, in every package
- E2E (Playwright, queue item 9): `apps/desktop/e2e/`
- Same rule applies to `packages/engine` when it opens

## 5. Enforcement summary

| Rule set                                                  | Tool               | Where it runs |
| --------------------------------------------------------- | ------------------ | ------------- |
| FSD layers, slice isolation, public API, segments         | Steiger            | CI + lefthook |
| Package direction, engine purity, process borders, cycles | dependency-cruiser | CI + lefthook |

Tool configuration itself is queue item 2/3 (Vitest, then dependency-cruiser + Steiger). This spec only fixes the rules they will encode.

## 6. Naming

- Folders and files: kebab-case (`gateway-list.tsx`, `wire-status.ts`)
- Slice names use domain language: `gateway`, `virtual-model`, `provider`, `target`, never `manager`, `helper`, `util`, `data`

## Out of scope

- `packages/engine` internal structure: own ADR at birth (see section 1)
- Migration of the two existing renderer files (`App.tsx`, `main.tsx`) happens in the implementation plan, not here
- Window-close vs quit lifecycle behavior: belongs to the gateway-lifecycle feature
