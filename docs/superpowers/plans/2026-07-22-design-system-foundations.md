# Design System Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two-tier design tokens (primitive → semantic) implemented in Tailwind CSS v4, with the existing shell restyled through them.

**Architecture:** Primitives live as plain CSS variables in `:root` (no utilities); semantic tokens live in `@theme` and are the only utilities components may use. All theming happens at the semantic tier via `light-dark()`; the OS drives the theme through `color-scheme: light dark`. No JS, no separate package.

**Tech Stack:** Tailwind CSS v4 (`@tailwindcss/vite`), electron-vite 5, React 19, oxfmt Tailwind class sorting.

Spec: `docs/superpowers/specs/2026-07-22-design-system-foundations-design.md`

## Global Constraints

- **Never write code comments** — CSS files included. Naming and structure carry the intent.
- Commits follow caveman-commit: `<type>(<scope>): <imperative>` ≤50 chars, body only for non-obvious why, trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- TypeScript stays maximally strict; do not touch tsconfig.
- No unit tests in this plan: foundations are pure CSS with no behavior (spec §Verification). Verification is build/lint/typecheck plus visual dark/light screenshots.
- Dependency versions are exact-pinned (`-E`).
- Component code uses only semantic utilities — never a primitive variable, never a raw hex.
- A PostToolUse hook runs oxfmt+oxlint on every TS edit and blocks on errors; fix immediately.
- The repository owner's private alias must not appear in any artifact. File contents are checked by the `forbidden-owner-alias` rule in `.gitleaks.toml`; coverage of other surfaces is per ADR-0011.

---

### Task 1: Tailwind v4 toolchain

**Files:**

- Modify: `apps/desktop/package.json` (via pnpm)
- Modify: `apps/desktop/electron.vite.config.ts`
- Modify: `apps/desktop/src/renderer/src/assets/main.css` (prepend import)
- Modify: `.oxfmtrc.json`

**Interfaces:**

- Consumes: nothing.
- Produces: a renderer build that processes Tailwind directives; `@import 'tailwindcss';` as the first line of `main.css` (Tasks 2–3 add `@theme` files that this pipeline consumes); oxfmt sorts Tailwind classes against `apps/desktop/src/renderer/src/assets/main.css`.

- [ ] **Step 1: Install Tailwind**

Run from repo root:

```bash
pnpm --filter @recompose/desktop add -D -E tailwindcss @tailwindcss/vite
```

Expected: both packages appear in `apps/desktop/package.json` devDependencies with exact versions; `pnpm-lock.yaml` updated. If install fails with `ERR_PNPM_IGNORED_BUILDS` naming a Tailwind-related package, add that package name with value `false` to the `allowBuilds:` map in `pnpm-workspace.yaml` (its prebuilt binaries ship in the package; the build script is unnecessary) and rerun the install.

- [ ] **Step 2: Register the vite plugin**

Replace the full contents of `apps/desktop/electron.vite.config.ts` with:

```ts
import tailwindcss from '@tailwindcss/vite';
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
    plugins: [react(), tailwindcss()],
  },
});
```

- [ ] **Step 3: Import Tailwind in the entry stylesheet**

Add as the first line of `apps/desktop/src/renderer/src/assets/main.css` (keep the rest of the file unchanged for now):

```css
@import 'tailwindcss';
```

- [ ] **Step 4: Point oxfmt at the stylesheet**

In `.oxfmtrc.json`, replace the `sortTailwindcss` block (including the commented-out `stylesheet` line) with:

```json
"sortTailwindcss": {
  "preserveDuplicates": false,
  "functions": ["clsx", "cn", "cva", "tw"],
  "stylesheet": "apps/desktop/src/renderer/src/assets/main.css"
}
```

- [ ] **Step 5: Verify the toolchain**

Run from repo root:

```bash
pnpm --filter @recompose/desktop build
pnpm fmt:check
```

Expected: build succeeds (renderer CSS output now contains Tailwind preflight rules); `fmt:check` exits 0 (if oxfmt errors on the `stylesheet` path, resolve it relative to the config file location and adjust).

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/package.json apps/desktop/electron.vite.config.ts apps/desktop/src/renderer/src/assets/main.css .oxfmtrc.json pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "build(desktop): add tailwind v4 toolchain

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

(`pnpm-workspace.yaml` only if Step 1 required an allowBuilds entry.)

---

### Task 2: Token files — primitives and semantic theme

**Files:**

- Create: `apps/desktop/src/renderer/src/assets/primitives.css`
- Create: `apps/desktop/src/renderer/src/assets/theme.css`
- Modify: `apps/desktop/src/renderer/src/assets/main.css` (add two imports)

**Interfaces:**

- Consumes: Tailwind pipeline from Task 1.
- Produces: semantic utilities for Task 3 — `bg-surface-{sidebar,toolbar,content,card,raised}`, `text-ink`, `text-ink-secondary`, `text-ink-tertiary`, `border-line-{subtle,faint,strong}`, `bg-accent`/`text-accent`, `{bg,text}-{success,warning,danger}`, `text-{title,heading,body,control,caption,overline,mono-value}`, `font-sans`/`font-mono`, `rounded-{chip,control,card,pill}`. Also the CSS variables themselves (`var(--color-ink)` etc.) for the base rules in Task 3.

- [ ] **Step 1: Create the primitive tier**

Create `apps/desktop/src/renderer/src/assets/primitives.css`:

```css
:root {
  --blue-500: #0a84ff;
  --blue-600: #007aff;
  --green-500: #32d74b;
  --green-600: #28cd41;
  --orange-500: #ff9f0a;
  --orange-600: #ff9500;
  --purple-500: #bf5af2;
  --purple-600: #af52de;
  --teal-500: #40c8e0;
  --teal-600: #30b0c7;
  --red-500: #ff453a;
  --red-600: #ff3b30;
  --yellow-500: #ffd60a;
  --yellow-600: #c79000;

  --white: #ffffff;
  --white-a90: rgb(255 255 255 / 90%);
  --white-a55: rgb(255 255 255 / 55%);
  --white-a28: rgb(255 255 255 / 28%);
  --white-a13: rgb(255 255 255 / 13%);
  --white-a08: rgb(255 255 255 / 8.5%);
  --white-a06: rgb(255 255 255 / 5.5%);

  --black-a88: rgb(0 0 0 / 88%);
  --black-a52: rgb(0 0 0 / 52%);
  --black-a28: rgb(0 0 0 / 28%);
  --black-a09: rgb(0 0 0 / 9%);
  --black-a06: rgb(0 0 0 / 5.5%);

  --gray-50: #f9f9fb;
  --gray-75-a80: rgb(246 246 250 / 80%);
  --gray-100: #f4f4f6;
  --gray-850: #2e2e33;
  --gray-900: #28282c;
  --gray-925-a82: rgb(30 30 34 / 82%);
  --gray-950: #1c1c1e;
}
```

- [ ] **Step 2: Create the semantic tier**

Create `apps/desktop/src/renderer/src/assets/theme.css`:

```css
@theme {
  --color-*: initial;
  --text-*: initial;
  --radius-*: initial;
  --font-*: initial;

  --font-sans: -apple-system, 'SF Pro Text', system-ui, sans-serif;
  --font-mono: 'SF Mono', ui-monospace, Menlo, monospace;

  --color-surface-sidebar: light-dark(var(--gray-75-a80), var(--gray-925-a82));
  --color-surface-toolbar: light-dark(var(--gray-100), var(--gray-900));
  --color-surface-content: light-dark(var(--gray-50), var(--gray-950));
  --color-surface-card: light-dark(var(--white), var(--gray-900));
  --color-surface-raised: light-dark(var(--white), var(--gray-850));

  --color-ink: light-dark(var(--black-a88), var(--white-a90));
  --color-ink-secondary: light-dark(var(--black-a52), var(--white-a55));
  --color-ink-tertiary: light-dark(var(--black-a28), var(--white-a28));

  --color-line-subtle: light-dark(var(--black-a09), var(--white-a08));
  --color-line-faint: light-dark(var(--black-a06), var(--white-a06));
  --color-line-strong: light-dark(var(--black-a28), var(--white-a13));

  --color-accent: light-dark(var(--blue-600), var(--blue-500));
  --color-success: light-dark(var(--green-600), var(--green-500));
  --color-warning: light-dark(var(--orange-600), var(--orange-500));
  --color-danger: light-dark(var(--red-600), var(--red-500));

  --text-title: 19px;
  --text-title--font-weight: 600;
  --text-title--letter-spacing: -0.4px;
  --text-heading: 15px;
  --text-heading--font-weight: 600;
  --text-body: 13px;
  --text-body--line-height: 1.45;
  --text-control: 12px;
  --text-caption: 11px;
  --text-overline: 9px;
  --text-overline--font-weight: 700;
  --text-overline--letter-spacing: 1.4px;
  --text-mono-value: 11px;

  --radius-chip: 4px;
  --radius-control: 6px;
  --radius-card: 10px;
  --radius-pill: 999px;
}
```

Note: `--font-*: initial` extends the spec's decision 3 to the font namespace for the same reason — only the two SF stacks may exist as `font-*` utilities.

- [ ] **Step 3: Wire the imports**

In `apps/desktop/src/renderer/src/assets/main.css`, the file must now start with:

```css
@import 'tailwindcss';
@import './primitives.css';
@import './theme.css';
```

Rest of the file still unchanged.

- [ ] **Step 4: Verify**

```bash
pnpm --filter @recompose/desktop build
pnpm fmt:check
```

Expected: both exit 0. Utilities are not in the output yet (nothing uses them until Task 3); this step only proves the token files parse.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/renderer/src/assets/primitives.css apps/desktop/src/renderer/src/assets/theme.css apps/desktop/src/renderer/src/assets/main.css
git commit -m "feat(desktop): two-tier design tokens

Primitives in :root produce no utilities; semantic tokens in @theme
are the only tier components touch. Theming is light-dark() at the
semantic tier, driven by color-scheme. Default color/text/radius/font
namespaces reset so only semantic utilities exist.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Shell restyle through semantic utilities

**Files:**

- Modify: `apps/desktop/src/renderer/src/assets/main.css` (full rewrite)
- Modify: `apps/desktop/src/renderer/src/App.tsx` (full rewrite)

**Interfaces:**

- Consumes: semantic utilities and CSS variables from Task 2; `.app-drag` is defined here and used in `App.tsx`.
- Produces: the app shell all future features build inside — `App.tsx` renders `aside` (sidebar) + `main` (content) styled exclusively with semantic utilities.

- [ ] **Step 1: Rewrite the entry stylesheet**

Replace the full contents of `apps/desktop/src/renderer/src/assets/main.css` with:

```css
@import 'tailwindcss';
@import './primitives.css';
@import './theme.css';

html,
body,
#root {
  margin: 0;
  height: 100%;
  background: transparent;
  color-scheme: light dark;
  font-family: var(--font-sans);
  color: var(--color-ink);
  user-select: none;
}

.app-drag {
  -webkit-app-region: drag;
}
```

Only what Tailwind cannot express stays here: the transparent chain the liquid glass window requires (ADR 0008), OS-driven `color-scheme`, and the native drag region.

- [ ] **Step 2: Rewrite the shell component**

Replace the full contents of `apps/desktop/src/renderer/src/App.tsx` with:

```tsx
function App(): React.JSX.Element {
  return (
    <div className="flex h-full">
      <aside className="app-drag w-60 bg-surface-sidebar px-4 pt-13 pb-4 text-body text-ink-secondary">
        Sidebar
      </aside>
      <main className="flex-1 bg-surface-content px-6 pt-13 pb-6 text-body">Main Area</main>
    </div>
  );
}

export default App;
```

Spacing maps to the design's 4px grid: `w-60` = 240px sidebar, `pt-13` = 52px traffic-light clearance, `px-4`/`pb-4` = 16px, `px-6`/`pb-6` = 24px pane inset. The sidebar wears the translucent `bg-surface-sidebar` scrim so the glass still shows through it; the content pane is opaque `bg-surface-content`.

- [ ] **Step 3: Verify the build uses the tokens**

```bash
pnpm --filter @recompose/desktop typecheck
pnpm --filter @recompose/desktop lint
pnpm --filter @recompose/desktop build
grep -l 'bg-surface-content' apps/desktop/out/renderer/assets/*.css
```

Expected: typecheck, lint, build exit 0; grep prints one CSS file (the utility was generated and is backed by `--color-surface-content`).

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/renderer/src/assets/main.css apps/desktop/src/renderer/src/App.tsx
git commit -m "feat(desktop): restyle shell with semantic tokens

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Visual verification in both themes

**Files:** none (verification only; fixes loop back into Task 2/3 files).

**Interfaces:**

- Consumes: the running app from Task 3.
- Produces: confirmation that no semantic mapping gap exists (the spec's theming gap test).

- [ ] **Step 1: Start the app**

Run in background from repo root:

```bash
pnpm --filter @recompose/desktop dev
```

Wait for the window (log line `dev server running` / window shows). The dev process name is `Electron`; bring it frontmost with:

```bash
osascript -e 'tell application id "com.github.Electron" to activate'
```

- [ ] **Step 2: Screenshot dark mode**

macOS appearance should be dark (default on this machine). Capture:

```bash
screencapture -x /tmp/foundations-dark.png
```

(Requires screen-recording permission; run without sandbox.) Read the image. Check: "Sidebar" text legible over glass, "Main Area" legible on `surface-content` dark gray, no invisible text.

- [ ] **Step 3: Screenshot light mode**

```bash
osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to false'
sleep 2
screencapture -x /tmp/foundations-light.png
osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to true'
```

Read the image. Check the same legibility list in light. Any invisible text/border = a semantic mapping gap; fix the mapping in `theme.css`, rebuild, re-shoot before proceeding.

- [ ] **Step 4: Stop the dev process**

Stop the background dev task. No commit (nothing changed unless a gap was fixed; gap fixes are committed as `fix(desktop): <what>` with the standard trailer).

---

### Task 5: ADR

**Files:**

- Create: `docs/adr/0009-two-tier-design-tokens.md`
- Modify: `docs/adr/README.md` (index row)

**Interfaces:**

- Consumes: decisions from the spec.
- Produces: the durable decision record required by project rules.

- [ ] **Step 1: Write the ADR via the skill**

Invoke the `architecture-decision-records` skill. The decision set to capture in ADR 0009: two-tier tokens (primitive → semantic, no component tier), Tailwind v4 CSS-first with default namespace resets, OS-driven theming via `color-scheme` + `light-dark()`, no separate UI package, Claude Design project as visual source of truth with naming owned by the codebase. Follow the skill's template and the existing files' style (see `docs/adr/0008-liquid-glass-window-chrome.md` for tone/length); add the index row to `docs/adr/README.md` exactly like the existing rows.

- [ ] **Step 2: Commit**

```bash
git add docs/adr/0009-two-tier-design-tokens.md docs/adr/README.md
git commit -m "docs(adr): two-tier design tokens on tailwind v4

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
