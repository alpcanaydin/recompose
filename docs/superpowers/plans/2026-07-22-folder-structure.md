# Folder Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the existing code into conformance with the approved folder-structure spec (`docs/superpowers/specs/2026-07-22-folder-structure-design.md`) and record the decision as an ADR.

**Architecture:** Three self-contained moves: split the Electron main process into bootstrap + `windows/`, move the renderer's two files into an FSD `app/` layer, and write ADR-0010. No new folders beyond what receives a file today (spec rule: a folder opens with its first real code). Enforcement tooling (Steiger, dependency-cruiser) is explicitly NOT this job — it is queue items 2/3.

**Tech Stack:** Electron 43 + electron-vite 6, React 19, TypeScript 7 (strict), pnpm workspaces + Turborepo.

## Global Constraints

- Never commit to `main` — all work happens on the current worktree branch `worktree-folder-structure-spec`, lands via PR.
- **No behavior change anywhere in this plan.** Per `.claude/rules/tdd-bdd.md` ("test code changes if and only if behavior changes") and because no test framework exists yet (Vitest is the next queue item), verification for every task is: `typecheck` + `lint` + `build` green, plus one manual dev-launch smoke check at the end.
- No code comments (project rule). The moved code must not gain any.
- File and folder names: kebab-case (`main-window.ts`, `app.tsx`).
- TypeScript maximum strictness is already configured — do not weaken any tsconfig.
- Commit messages: Conventional Commits, terse, why over what (caveman-commit style).
- All commands run from the worktree root: `/Users/reyz/Projects/recompose/.claude/worktrees/folder-structure-spec`.

---

### Task 1: Split main process into bootstrap + windows/

**Files:**

- Create: `apps/desktop/src/main/windows/main-window.ts`
- Modify: `apps/desktop/src/main/index.ts` (full rewrite, shrinks to bootstrap)

**Interfaces:**

- Consumes: nothing from other tasks.
- Produces: `createMainWindow(): void` exported from `apps/desktop/src/main/windows/main-window.ts` — the only window factory; `main/index.ts` is composition only.

- [ ] **Step 1: Create `apps/desktop/src/main/windows/main-window.ts`**

The body is today's `createWindow` + `applyGlassBackdrop`, unchanged except: the function is renamed `createMainWindow` and exported, and the icon import gains one `../` (the file is one level deeper). The `join(__dirname, ...)` paths do NOT change — they are runtime paths inside the bundled `out/main`, independent of source layout.

```ts
import { is } from '@electron-toolkit/utils';
import { BrowserWindow, shell } from 'electron';
import liquidGlass from 'electron-liquid-glass';
import { join } from 'path';

import icon from '../../../resources/icon.png?asset';

const isMac = process.platform === 'darwin';

function applyGlassBackdrop(window: BrowserWindow): void {
  window.webContents.once('did-finish-load', () => {
    liquidGlass.addView(window.getNativeWindowHandle(), { opaque: false });
  });
}

export function createMainWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(isMac
      ? {
          transparent: true,
          titleBarStyle: 'hiddenInset' as const,
        }
      : {}),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  });

  if (isMac) {
    applyGlassBackdrop(mainWindow);
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);

    return { action: 'deny' };
  });

  const { ELECTRON_RENDERER_URL: rendererUrl } = process.env;

  if (is.dev && rendererUrl) {
    void mainWindow.loadURL(rendererUrl);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}
```

- [ ] **Step 2: Rewrite `apps/desktop/src/main/index.ts` as bootstrap only**

Replace the entire file content with:

```ts
import { electronApp, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow } from 'electron';

import { createMainWindow } from './windows/main-window';

void app.whenReady().then(() => {
  electronApp.setAppUserModelId('sh.recompose.app');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

- [ ] **Step 3: Verify**

Run: `pnpm --filter @recompose/desktop run typecheck && pnpm --filter @recompose/desktop run lint && pnpm --filter @recompose/desktop run build`
Expected: all three exit 0. Typical failure: wrong `../` count on the icon import → typecheck error "Cannot find module '../../../resources/icon.png?asset'".

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/main
git commit -m "refactor(desktop): split main into bootstrap and windows module

First step of the folder-structure spec: main/index.ts is
composition only; window construction lives in main/windows/."
```

---

### Task 2: Move renderer into FSD app layer

**Files:**

- Move: `apps/desktop/src/renderer/src/main.tsx` → `apps/desktop/src/renderer/src/app/main.tsx`
- Move: `apps/desktop/src/renderer/src/App.tsx` → `apps/desktop/src/renderer/src/app/app.tsx`
- Move: `apps/desktop/src/renderer/src/assets/{main,primitives,theme}.css` → `apps/desktop/src/renderer/src/app/styles/`
- Modify: `apps/desktop/src/renderer/index.html:15` (script src)

**Interfaces:**

- Consumes: nothing from Task 1 (independent).
- Produces: FSD `app/` layer — entry `app/main.tsx`, root component `app/app.tsx` (default export `App`), global styles `app/styles/main.css`. Future layers (`pages/`, `widgets/`, …) open beside `app/` when their first file lands; nothing pre-creates them.

- [ ] **Step 1: Move the files with git mv**

```bash
cd apps/desktop/src/renderer/src
mkdir -p app/styles
git mv main.tsx app/main.tsx
git mv App.tsx app/app.tsx
git mv assets/main.css app/styles/main.css
git mv assets/primitives.css app/styles/primitives.css
git mv assets/theme.css app/styles/theme.css
cd -
```

(`assets/` becomes empty and disappears — git tracks files, not directories.)

- [ ] **Step 2: Fix imports in `app/main.tsx`**

Replace the entire file content with (only the two relative paths changed):

```tsx
import './styles/main.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './app';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`app/app.tsx` and the css files need no content change — `main.css` imports `./primitives.css` / `./theme.css`, which moved together with it.

- [ ] **Step 3: Point `index.html` at the new entry**

In `apps/desktop/src/renderer/index.html` change line 15:

```html
<script type="module" src="/src/app/main.tsx"></script>
```

- [ ] **Step 4: Verify**

Run: `pnpm --filter @recompose/desktop run typecheck && pnpm --filter @recompose/desktop run lint && pnpm --filter @recompose/desktop run build`
Expected: all exit 0. Typical failure: stale script src in index.html → build error "Rollup failed to resolve import /src/main.tsx".

- [ ] **Step 5: Dev-launch smoke check**

Run: `pnpm --filter @recompose/desktop run dev` (or the project's `run-desktop` skill), wait for the window.
Expected: window opens showing the "Sidebar" / "Main Area" placeholder layout with glass backdrop on macOS — identical to before. Then quit with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/renderer
git commit -m "refactor(desktop): move renderer entry into FSD app layer

Renderer adopts Feature-Sliced Design per the folder-structure
spec; app/ is the only layer with code today, others open with
their first file."
```

---

### Task 3: Write ADR-0010

**Files:**

- Create: `docs/adr/0010-folder-structure-fsd-and-enforced-boundaries.md`
- Modify: `docs/adr/README.md` (index table — append the row below after the 0009 row)

```markdown
| [0010](0010-folder-structure-fsd-and-enforced-boundaries.md) | Folder Structure — FSD Renderer, Enforced Boundaries | Accepted | 2026-07-22 |
```

**Interfaces:**

- Consumes: nothing — documents the decision behind Tasks 1–2.
- Produces: the ADR every future structure question defers to.

- [ ] **Step 1: Invoke the ADR skill**

Project rule: ADRs go through the `architecture-decision-records` skill (or `new-adr`). Invoke it; if its template matches the house format below (it should — ADR-0001..0009 use it), proceed with this content:

```markdown
# ADR-0010: Folder Structure — FSD Renderer, Enforced Boundaries

**Status**: Accepted
**Date**: 2026-07-22

## Context

Feature development is about to start. Placement decisions ("where does
this file go") must be closed to interpretation so they cannot drift
between coding sessions; every rule must be machine-enforceable. Full
design: `docs/superpowers/specs/2026-07-22-folder-structure-design.md`.

## Decision

- **Monorepo map**: `apps/desktop` (exists) plus reserved names
  `packages/engine`, `packages/contracts`, `apps/headless`. A package
  opens with its first real code; its boundary rules exist beforehand.
  Direction: `apps/desktop → packages/contracts ← packages/engine`;
  engine never imports `electron` or any workspace package but
  `contracts`; engine internals get their own ADR when the package opens.
- **Main process**: `main/index.ts` is bootstrap only; modules
  `windows/`, `ipc/`, `engine-host/` (utilityProcess spawn + engine
  entry). `preload/` stays a single file by design — growth there means
  the exposed API surface is too wide.
- **Renderer**: full Feature-Sliced Design — layers
  `app/pages/widgets/features/entities/shared`, purpose-named segments
  `ui/model/api/lib` (essence names `components/hooks/types/utils`
  forbidden), slice public API via `index.ts`, TanStack route files in
  `app/routes/` delegating to `pages/`.
- **Tests**: colocated `*.test.ts`; Playwright e2e in `apps/desktop/e2e/`.
- **Enforcement**: Steiger for FSD rules, dependency-cruiser for package
  direction, process boundaries, engine purity, and import cycles —
  configured in the upcoming tooling jobs, rules fixed here.

## Alternatives

- **Bespoke feature-based hybrid (bulletproof-react style)**: lighter,
  but its rules exist only as far as we write them — every unwritten
  gap is interpretation room, exactly what this decision removes. FSD
  is externally documented and has an official linter.
- **Technical layers (`components/hooks/utils`)**: does not scale past a
  handful of screens and conflicts with the clean-code naming rules.
- **Steiger alone (no dependency-cruiser)**: Steiger only sees FSD; it
  cannot express monorepo direction, Electron process borders, or the
  engine purity rule.

## Consequences

**Good**: placement questions are pre-answered by a published
methodology; both rule sets are lintable in CI; reserved package names
make future boundaries explicit today.

**Bad**: FSD ceremony (slice public APIs, entity/feature categorization)
on a one-person project; two structure linters to configure and keep
green.
```

- [ ] **Step 2: Verify**

Run: `ls docs/adr/ | grep 0010`
Expected: `0010-folder-structure-fsd-and-enforced-boundaries.md`. Confirm the README index table has the 0010 row from the Files section above.

- [ ] **Step 3: Commit**

```bash
git add docs/adr
git commit -m "docs(adr): record folder-structure decision (ADR-0010)"
```

---

## Done criteria

All three tasks committed on `worktree-folder-structure-spec`; `typecheck`, `lint`, `build` green; dev smoke unchanged. PR creation is not part of this plan — it goes through the `superpowers:finishing-a-development-branch` flow (PR body via its own rules, CodeRabbit findings judged per project memory).
