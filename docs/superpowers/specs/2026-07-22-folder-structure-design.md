# Folder Structure — Design

**Date:** 2026-07-22
**Status:** Approved in brainstorm; pending implementation plan

## Goal

Fix the repository's folder structure before feature development starts, at every level: monorepo package map, Electron process layout (`main`/`preload`/`renderer`), and renderer internals. Every placement question must have a pre-written answer, and every rule must be machine-enforced — no room for session-to-session interpretation drift.

## Guiding decision

Two published conventions, one tool each, zero overlap:

- **Renderer:** full [Feature-Sliced Design](https://feature-sliced.design/) (FSD), enforced by [Steiger](https://github.com/feature-sliced/steiger). FSD was chosen over a bespoke hybrid precisely because it is an externally documented standard: "where does this file go" is answered by the methodology, not by whoever (or whatever) is writing code that day.
- **Repo graph:** [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) enforces everything FSD cannot see — package direction, Electron process boundaries, the engine's purity rule, and circular-import bans.

## 1. Monorepo map

```
apps/
└─ desktop/            # Electron app — exists today; the gateway server is spawned from here
packages/
├─ engine/             # reserved — pure-TS gateway engine (ADR-0002); opens with its first real code
└─ contracts/          # reserved — domain types + zod schemas: the IPC and engine message contract
apps/headless/         # reserved, may never open — CLI mode ("recompose serve")
design-system/         # Claude Design library (exists, unchanged)
docs/adr/              # exists, unchanged
```

Reserved packages are named now so their boundary rules exist before their first file does. No empty scaffolds (YAGNI): a package opens when its first real code lands, and `packages/engine` gets its own internal-structure ADR at that moment (its shape depends on which OSS gateway code gets adapted — designing it earlier is speculation).

**Dependency direction (dependency-cruiser rules, active from day one):**

- `apps/desktop` → `packages/contracts` ← `packages/engine`
- `packages/engine` must never import `electron` or any workspace package other than `contracts` (regular npm dependencies are fine)
- `apps/desktop` and `packages/engine` must never import each other
- `apps/headless` (if it ever opens) → `packages/engine` + `packages/contracts` only
- No circular imports anywhere in the repo

## 2. Electron process layout (`apps/desktop/src`)

```
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

- `renderer` must never import from `main` or `preload` (and vice versa) — they communicate only via IPC
- `main`/`preload` must never import from `renderer`
- Only `engine-host` may reference the engine entry

## 3. Renderer — full Feature-Sliced Design

Root: `src/renderer/src/`. Standard FSD layers, no custom layers:

```
app/          # providers, router setup, global styles
│  └─ routes/  # TanStack Router file-based route files — thin, delegate to pages
pages/        # one slice per screen/surface: gateway-canvas, providers, settings, …
widgets/      # self-sufficient page blocks: sidebar, toolbar, bottom-log-panel, inspector-drawer
features/     # user actions: wire-virtual-model, start-stop-gateway, connect-provider, …
entities/     # domain objects: gateway, virtual-model, router-node, provider, target
shared/       # ui kit (DS primitives), ipc client, config — no business logic
```

Layer import rule (enforced by Steiger): a layer may import only from layers **below** it (`app` → `pages` → `widgets` → `features` → `entities` → `shared`). Slices on the same layer never import each other.

**Segments** inside every slice — purpose-named, never essence-named (`components/`, `hooks/`, `types/`, `utils/` are forbidden as folder names):

```
entities/gateway/
├─ ui/       # components + hooks
├─ model/    # state, schemas, behavior
├─ api/      # IPC calls toward main
└─ lib/      # slice-local library code (rare)
```

A segment opens when its first file lands. Each slice exposes a public API `index.ts`; deeper imports are blocked by Steiger. Segment-level barrel files are not used (Vite tree-shaking).

**Placement rule (FSD v2.1 — "start simple, extract when needed"):** new code goes into the `pages/` slice it serves. It moves down a layer only when the same code is _currently_ used in 2+ places, the usages don't always change together, and the boundary is stable — never for hypothetical reuse. The minimal valid tree is `app/ + pages/ + shared/`; `widgets/`, `features/`, `entities/` open at their first confirmed multi-use, like every other folder in this spec.

| It is a…                                                                    | It goes to         |
| --------------------------------------------------------------------------- | ------------------ |
| anything single-use, or in doubt                                            | its `pages/` slice |
| domain model used by 2+ pages/widgets **today**                             | `entities/`        |
| user interaction used by 2+ pages/widgets **today**                         | `features/`        |
| composite block reused across pages **today**                               | `widgets/`         |
| infrastructure with zero business logic (ui kit, IPC client, CRUD plumbing) | `shared/`          |

`shared/` exposes a public API per segment (`shared/ui/index.ts`, `shared/api/index.ts`) — no top-level `shared/index.ts`. Every placement decision for a new renderer file goes through the `feature-sliced-design` skill's decision tree (rule recorded in `CLAUDE.md`).

**TanStack Router fit:** file-based route files live in `app/routes/`; each route file only mounts a `pages/` slice. This is the documented FSD + TanStack combination; if the route-file location fights the router's generator, TanStack's Virtual File Routes are the sanctioned escape hatch.

## 4. Tests

- Unit/integration: colocated — `wire-status.ts` + `wire-status.test.ts` side by side, in every package
- E2E (Playwright, queue item 9): `apps/desktop/e2e/`
- Same rule applies to `packages/engine` when it opens

## 5. Enforcement summary

| Rule set                                                  | Tool               | Where it runs |
| --------------------------------------------------------- | ------------------ | ------------- |
| FSD layers, slice isolation, public API, segments         | Steiger            | CI + lefthook |
| Package direction, engine purity, process borders, cycles | dependency-cruiser | CI + lefthook |

Tool configuration itself is queue item 2/3 (Vitest, then dependency-cruiser + Steiger); this spec only fixes the rules they will encode.

## 6. Naming

- Folders and files: kebab-case (`gateway-list.tsx`, `wire-status.ts`)
- Slice names use domain language: `gateway`, `virtual-model`, `provider`, `target` — never `manager`, `helper`, `util`, `data`

## Out of scope

- `packages/engine` internal structure — own ADR at birth (see section 1)
- Migration of the two existing renderer files (`App.tsx`, `main.tsx`) happens in the implementation plan, not here
- Window-close vs quit lifecycle behavior — belongs to the gateway-lifecycle feature
