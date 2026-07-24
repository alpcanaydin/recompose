# Storybook implementation plan

> **For agentic workers:** This plan requires the sub-skill superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement it task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working Storybook 10.5 workshop for the renderer with six seed stories. Story tests plus blocking accessibility join the existing Vitest suite, a `storybook build` smoke and a story-required rule join CI, and Model Context Protocol (MCP) wiring lands at project scope.

**Architecture:** Storybook lives in `apps/desktop` on the `@storybook/react-vite` framework with Component Story Format (CSF) factories. `viteFinal` re-declares the renderer's `@renderer` alias and the Tailwind plugin, because Storybook never reads `electron.vite.config.ts`. Stories colocate in Feature-Sliced Design (FSD) `ui/` segments. Wired components render through a typed fake of the `window.recompose` bridge, and `@storybook/addon-vitest` runs every story as a browser test in the existing Playwright Chromium setup.

**Tech Stack:** Storybook 10.5.4, `@storybook/react-vite`, `@storybook/addon-vitest`, `@storybook/addon-a11y`, `@storybook/addon-themes`, `@storybook/addon-mcp` 0.7.0, Vitest 4 browser mode, Tailwind 4.

## Global constraints

- Spec: `docs/superpowers/specs/2026-07-24-storybook-design.md`.
- **Never commit to `main`.** All work stays on branch `worktree-storybook` and lands through one Pull Request.
- **The repository owner's private alias must never appear** in any file, message, or artifact. The gitleaks `forbidden-owner-alias` rule enforces file contents.
- **No code comments**, with one spec-mandated exception: JSDoc on exported components, props, and stories is manifest documentation for agents, not commentary. Architecture Decision Record (ADR) 0029 records the exception. Every JSDoc block must describe purpose or usage, never implementation.
- **Test-first where behavior changes.** One behavior per test, state-based assertions. Stories are behavior specs: one concept per story.
- **The Test-Driven Development (TDD) invariant:** test code changes if and only if behavior changes. The `EmptyState` extraction in Task 3 is a pure refactor and must not touch `router.browser.test.tsx`.
- **Maximum-strictness TypeScript:** no `any`, no `as` casts to silence errors. The strict flags include `noPropertyAccessFromIndexSignature`, so index-signature reads use bracket access.
- **Every commit uses Conventional Commits** and ends with the trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- **New dependencies pin the exact version** with `pnpm add -E`. If pnpm blocks the install under `minimumReleaseAge`, add the exact `name@version` to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` and include that file in the commit.
- **Authored markdown passes the gates:** Vale (Microsoft style at full strength) and cspell. No em dashes in prose: when a sentence reaches for one, rewrite the sentence rather than swapping in a colon. Expand each acronym on first use. Headings are sentence case. A fresh worktree needs `mise exec -- vale sync` once before Vale runs.
- **The exact package set:** `storybook@10.5.4`, `@storybook/react-vite@10.5.4`, `@storybook/addon-a11y@10.5.4`, `@storybook/addon-vitest@10.5.4`, `@storybook/addon-themes@10.5.4`, `@storybook/addon-mcp@0.7.0`.
- **Accessibility blocks:** `parameters.a11y.test` is `'error'`. A story opts out only through a story-level `parameters: { a11y: { test: 'off' } }` accompanied by a `Stories-exempt`-style reason recorded in the story's JSDoc.
- **lefthook runs no test job today.** Tests gate in the CI `check` job (transitively required through `ci-success`). Story tests join `pnpm test`, which is exactly that path.

---

### Task 1: Storybook 10.5 boots against the renderer

**Files:**

- Create: `apps/desktop/.storybook/main.ts`
- Create: `apps/desktop/.storybook/preview.ts`
- Create: `apps/desktop/.storybook/preview.css`
- Create: `apps/desktop/src/renderer/src/pages/providers/ui/text-field.stories.tsx`
- Modify: `apps/desktop/package.json` (devDependencies, scripts, imports field)
- Modify: `apps/desktop/tsconfig.node.json` (include), `apps/desktop/tsconfig.web.json` (include)
- Modify: `apps/desktop/src/renderer/src/pages/providers/ui/text-field.tsx` (JSDoc only)
- Modify: `.gitignore`
- Modify: `knip.json` (only if the dead-code gate flags the new files)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `preview` (the default export of `.storybook/preview.ts`), imported by every story as `#.storybook/preview`. Stories call `preview.meta({ component })` and `meta.story({ args })`. Tasks 2 through 5 rely on this.

- [ ] **Step 1: Install the exact package set**

Run:

```bash
pnpm --filter @recompose/desktop add -E -D storybook@10.5.4 @storybook/react-vite@10.5.4 @storybook/addon-a11y@10.5.4 @storybook/addon-vitest@10.5.4 @storybook/addon-themes@10.5.4 @storybook/addon-mcp@0.7.0
```

If pnpm reports a `minimumReleaseAge` block, add each blocked `name@version` to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` and re-run.

- [ ] **Step 2: Add scripts and subpath imports to `apps/desktop/package.json`**

Add to `scripts`:

```json
    "storybook": "storybook dev -p 6006",
    "storybook:build": "storybook build"
```

Add a top-level `imports` field. CSF factories resolve `#.storybook/preview` through it, and `moduleResolution` is already `bundler`:

```json
  "imports": {
    "#*": ["./*", "./*.ts", "./*.tsx"]
  }
```

- [ ] **Step 3: Write `.storybook/main.ts`**

```ts
import { defineMain } from '@storybook/react-vite/node';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineMain({
  framework: '@storybook/react-vite',
  stories: ['../src/renderer/src/**/*.stories.tsx'],
  addons: [
    '@storybook/addon-a11y',
    '@storybook/addon-vitest',
    '@storybook/addon-themes',
    '@storybook/addon-mcp',
  ],
  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },
  viteFinal: (config) => ({
    ...config,
    resolve: {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
        '@renderer': resolve(import.meta.dirname, '../src/renderer/src'),
      },
    },
    plugins: [...(config.plugins ?? []), tailwindcss()],
  }),
});
```

The framework injects the React plugin itself, so only Tailwind and the alias need replication. If `defineMain` isn't exported from `@storybook/react-vite/node`, check `node_modules/@storybook/react-vite/package.json` `exports` for the node entry and note the deviation in your report.

- [ ] **Step 4: Write `.storybook/preview.css` and `.storybook/preview.ts`**

`preview.css`:

```css
.scheme-light {
  color-scheme: light;
}

.scheme-dark {
  color-scheme: dark;
}
```

`preview.ts`:

```ts
import addonA11y from '@storybook/addon-a11y';
import { withThemeByClassName } from '@storybook/addon-themes';
import { definePreview } from '@storybook/react-vite';

import '../src/renderer/src/app/styles/main.css';
import './preview.css';

export default definePreview({
  addons: [addonA11y()],
  decorators: [
    withThemeByClassName({
      themes: { light: 'scheme-light', dark: 'scheme-dark' },
      defaultTheme: 'light',
      parentSelector: 'html',
    }),
  ],
  parameters: {
    a11y: { test: 'error' },
  },
});
```

The class flip drives the token tiers because every semantic token uses `light-dark()`.

- [ ] **Step 5: Register the new files with the tsconfigs**

In `apps/desktop/tsconfig.node.json`, append to `include`:

```json
".storybook/main.ts"
```

In `apps/desktop/tsconfig.web.json`, append to `include`:

```json
".storybook/preview.ts"
```

- [ ] **Step 6: Add JSDoc to `TextField` and write its stories**

In `text-field.tsx`, add JSDoc above the type members and the export (no other change):

```tsx
type TextFieldProps = {
  /** Visible label wrapping the input. */
  label: string;
  /** Controlled input value. */
  value: string;
  /** Switches masking for secret entry. */
  type?: 'password' | 'text';
  /** Receives the raw input value on every keystroke. */
  onChangeValue: (value: string) => void;
};

/** Labeled single-line text input used across provider forms. */
export function TextField({ label, value, type = 'text', onChangeValue }: TextFieldProps) {
```

Create `text-field.stories.tsx` next to it:

```tsx
import preview from '#.storybook/preview';

import { TextField } from './text-field';

const meta = preview.meta({
  component: TextField,
});

/** Empty input waiting for a value. */
export const Empty = meta.story({
  args: { label: 'Provider', value: '', onChangeValue: () => {} },
});

/** Input carrying a typed value. */
export const Filled = meta.story({
  args: { label: 'Provider', value: 'anthropic', onChangeValue: () => {} },
});

/** Password variant masking the secret. */
export const Password = meta.story({
  args: { label: 'Secret', type: 'password', value: 'not-a-real-secret', onChangeValue: () => {} },
});
```

- [ ] **Step 7: Ignore the build output**

Append to `.gitignore`:

```
storybook-static/
```

- [ ] **Step 8: Build Storybook and run the repository gates**

Run: `pnpm --filter @recompose/desktop run storybook:build`
Expected: exit 0, output lands in `apps/desktop/storybook-static/`.

Run: `pnpm --filter @recompose/desktop run typecheck && pnpm exec oxlint && pnpm run lint:dead && pnpm run lint:fsd`
Expected: all exit 0. If `lint:dead` (knip) flags `.storybook` files or the new packages, add to the `apps/desktop` workspace in `knip.json`:

```json
      "entry": [
        "build/after-pack.cjs",
        "e2e/security-boot-proof.mjs",
        ".storybook/main.ts",
        ".storybook/preview.ts"
      ],
```

- [ ] **Step 9: Commit**

```bash
git add apps/desktop/.storybook apps/desktop/src/renderer/src/pages/providers/ui/text-field.stories.tsx apps/desktop/src/renderer/src/pages/providers/ui/text-field.tsx apps/desktop/package.json apps/desktop/tsconfig.node.json apps/desktop/tsconfig.web.json .gitignore pnpm-lock.yaml
git commit -m "feat(desktop): storybook 10.5 boots against the renderer"
```

Include `knip.json` or `pnpm-workspace.yaml` when a contingency step touched them.

---

### Task 2: Stories run as browser tests with blocking accessibility

**Files:**

- Modify: `apps/desktop/vitest.config.ts`

**Interfaces:**

- Consumes: the `TextField` stories and `.storybook` config from Task 1.
- Produces: a Vitest project named `storybook`. Later tasks verify stories with `pnpm --filter @recompose/desktop exec vitest run --project storybook`.

- [ ] **Step 1: Confirm the missing project fails first**

Run: `pnpm --filter @recompose/desktop exec vitest run --project storybook`
Expected: `FAIL` with an error naming no matching project.

- [ ] **Step 2: Add the `storybook` project and exclude stories from coverage**

In `vitest.config.ts`, add the import:

```ts
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
```

Append `'src/**/*.stories.tsx'` to `coverage.exclude` (stories are specs, not product code). Append a third entry to `projects`:

```ts
      {
        plugins: [storybookTest({ configDir: '.storybook' })],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
```

CSF factories make a `vitest.setup.ts` unnecessary because project annotations load automatically. If story tests error on unresolved JSX, add `react()` to that project's plugin list and note the deviation.

- [ ] **Step 3: Run the story project and watch it pass**

Run: `pnpm --filter @recompose/desktop exec vitest run --project storybook`
Expected: `PASS`, three story tests, each including an accessibility pass. If axe reports a genuine violation in `TextField`, fix the component's styling through the design tokens and report it. Never soften `parameters.a11y.test`.

- [ ] **Step 4: Run the full suite with coverage**

Run: `pnpm --filter @recompose/desktop run test`
Expected: exit 0 with every threshold met. If a threshold dips, the fix is more stories or tests, never new coverage excludes.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/vitest.config.ts
git commit -m "test(desktop): stories run as browser tests with blocking a11y"
```

---

### Task 3: Presentational seeds, with `EmptyState` extracted to a page slice

**Files:**

- Create: `apps/desktop/src/renderer/src/pages/home/ui/empty-state.tsx`
- Create: `apps/desktop/src/renderer/src/pages/home/ui/empty-state.stories.tsx`
- Create: `apps/desktop/src/renderer/src/pages/home/index.ts`
- Create: `apps/desktop/src/renderer/src/pages/providers/ui/account-kind-field.stories.tsx`
- Modify: `apps/desktop/src/renderer/src/app/routes/index.tsx`
- Modify: `apps/desktop/src/renderer/src/pages/providers/ui/account-kind-field.tsx` (JSDoc only)

**Interfaces:**

- Consumes: `preview` from Task 1.
- Produces: `EmptyState` exported from `pages/home` (the route adapter and the story both import it).

- [ ] **Step 1: Move `EmptyState` to a page slice (pure refactor, no test changes)**

`pages/home/ui/empty-state.tsx`:

```tsx
/** Landing message shown before any gateway exists. */
export function EmptyState() {
  return <p>Select a gateway or create one to get started.</p>;
}
```

`pages/home/index.ts`:

```ts
export { EmptyState } from './ui/empty-state';
```

`app/routes/index.tsx` becomes:

```tsx
import { createFileRoute } from '@tanstack/react-router';

import { EmptyState } from '../../pages/home';

export const Route = createFileRoute('/')({
  component: EmptyState,
});
```

Match the import style the providers route uses for its page slice, and adjust the relative path only if that file resolves differently.

- [ ] **Step 2: Prove the refactor is pure**

Run: `pnpm --filter @recompose/desktop exec vitest run --project browser`
Expected: `PASS` with `router.browser.test.tsx` untouched and green. Then run `pnpm run lint:fsd`.
Expected: exit 0 (the new slice exposes a public API and no import crosses it).

- [ ] **Step 3: Write the two stories, failing count first**

`pages/home/ui/empty-state.stories.tsx`:

```tsx
import preview from '#.storybook/preview';

import { EmptyState } from './empty-state';

const meta = preview.meta({
  component: EmptyState,
});

/** The landing message a fresh install shows. */
export const Basic = meta.story({});
```

Add JSDoc to `account-kind-field.tsx` above the export (no other change):

```tsx
/** Selector for the three account kinds an account can connect as. */
export function AccountKindField({ value, onChangeValue }: AccountKindFieldProps) {
```

`pages/providers/ui/account-kind-field.stories.tsx`:

```tsx
import preview from '#.storybook/preview';

import { AccountKindField } from './account-kind-field';

const meta = preview.meta({
  component: AccountKindField,
});

/** Selector resting on the api-key kind. */
export const Basic = meta.story({
  args: { value: 'api-key', onChangeValue: () => {} },
});
```

Run the story project before adding the files to confirm the count, then after: the test count must grow by exactly two.

- [ ] **Step 4: Run the story project and the full suite**

Run: `pnpm --filter @recompose/desktop exec vitest run --project storybook && pnpm --filter @recompose/desktop run test`
Expected: `PASS`, five story tests, coverage thresholds met.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/renderer/src/pages/home apps/desktop/src/renderer/src/app/routes/index.tsx apps/desktop/src/renderer/src/pages/providers/ui/account-kind-field.stories.tsx apps/desktop/src/renderer/src/pages/providers/ui/account-kind-field.tsx
git commit -m "feat(desktop): presentational seed stories, empty state joins a page slice"
```

---

### Task 4: Wired stories over a typed fake bridge

**Files:**

- Create: `apps/desktop/.storybook/recompose-bridge.tsx`
- Create: `apps/desktop/src/renderer/src/pages/providers/ui/account-list.stories.tsx`
- Create: `apps/desktop/src/renderer/src/pages/providers/ui/connect-account-form.stories.tsx`
- Create: `apps/desktop/src/renderer/src/pages/providers/ui/providers-page.stories.tsx`
- Modify: `apps/desktop/.storybook/preview.ts`
- Modify: `apps/desktop/tsconfig.web.json` (include)

**Interfaces:**

- Consumes: `preview` from Task 1, plus the `RecomposeIpc` and `AccountsDocument` types from `@recompose/contracts`.
- Produces: `withRecomposeBridge` (a Storybook decorator) and the story parameter shape `parameters.bridge: { accounts?: AccountsDocument; overrides?: Partial<RecomposeIpc> }`. The `storybook-stories` skill in Task 7 documents it.

- [ ] **Step 1: Write the fake bridge and decorator**

`.storybook/recompose-bridge.tsx` mirrors the fake in `providers-page.browser.test.tsx` and stays under `.storybook/` until a second consumer justifies extraction:

```tsx
import type { AccountsDocument, RecomposeIpc } from '@recompose/contracts';
import type { Decorator } from '@storybook/react-vite';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';

const emptyDocument: AccountsDocument = { schemaVersion: 1, accounts: [] };

type BridgeParameters = {
  accounts?: AccountsDocument;
  overrides?: Partial<RecomposeIpc>;
};

function installBridge(parameters: BridgeParameters): void {
  let registry = parameters.accounts ?? emptyDocument;

  window.recompose = {
    'gateways:list': async () => Promise.resolve({ ok: true, value: [] }),
    'gateways:save': async () => Promise.resolve({ ok: true, value: [] }),
    'settings:get': async () =>
      Promise.resolve({
        ok: true,
        value: { schemaVersion: 1, theme: 'system', enginePort: 8397 },
      }),
    'settings:save': async (settings) => Promise.resolve({ ok: true, value: settings }),
    'accounts:list': async () => Promise.resolve({ ok: true, value: registry }),
    'accounts:connect': async (request) => {
      const id = `a${registry.accounts.length + 1}`;
      registry = {
        ...registry,
        accounts: [
          ...registry.accounts,
          {
            id,
            provider: request.provider,
            kind: request.kind,
            label: request.label,
            credentialRef: `c-${id}`,
          },
        ],
      };

      return Promise.resolve({ ok: true, value: registry });
    },
    'accounts:remove': async (request) => {
      registry = {
        ...registry,
        accounts: registry.accounts.filter((row) => row.id !== request.id),
      };

      return Promise.resolve({ ok: true, value: registry });
    },
    ...parameters.overrides,
  };
}

export const withRecomposeBridge: Decorator = (Story, context) => {
  const parameters = (context.parameters['bridge'] ?? {}) as BridgeParameters;
  installBridge(parameters);

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return (
    <Suspense fallback={null}>
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    </Suspense>
  );
};
```

The `as BridgeParameters` narrows an untyped parameter bag at the boundary. It silences no error, matching the posture the browser tests take toward fixtures. If `Decorator` isn't exported from `@storybook/react-vite`, import it from the path `node_modules/@storybook/react-vite/dist/index.d.ts` names, and note the deviation.

- [ ] **Step 2: Register the decorator and the tsconfig entry**

In `.storybook/preview.ts`, import and prepend the decorator:

```ts
import { withRecomposeBridge } from './recompose-bridge';
```

```ts
  decorators: [
    withRecomposeBridge,
    withThemeByClassName({
```

In `apps/desktop/tsconfig.web.json`, append to `include`:

```json
".storybook/recompose-bridge.tsx"
```

- [ ] **Step 3: Confirm existing stories still pass with the decorator active**

Run: `pnpm --filter @recompose/desktop exec vitest run --project storybook`
Expected: `PASS`, five story tests (the decorator is neutral for presentational stories).

- [ ] **Step 4: Write the three wired stories**

`account-list.stories.tsx`:

```tsx
import type { AccountsDocument } from '@recompose/contracts';

import preview from '#.storybook/preview';

import { AccountList } from './account-list';

const seeded: AccountsDocument = {
  schemaVersion: 1,
  accounts: [
    {
      id: 'a1',
      provider: 'anthropic',
      kind: 'subscription',
      label: 'Claude Max',
      credentialRef: 'c1',
    },
    {
      id: 'a2',
      provider: 'openrouter',
      kind: 'api-key',
      label: 'Fallback key',
      credentialRef: 'c2',
    },
  ],
};

const meta = preview.meta({
  component: AccountList,
});

/** Two connected accounts with their remove affordances. */
export const Populated = meta.story({
  args: { accounts: seeded.accounts },
  parameters: { bridge: { accounts: seeded } },
});

/** No accounts connected yet. */
export const Empty = meta.story({
  args: { accounts: [] },
});
```

`connect-account-form.stories.tsx`:

```tsx
import preview from '#.storybook/preview';

import { ConnectAccountForm } from './connect-account-form';

const meta = preview.meta({
  component: ConnectAccountForm,
});

/** Blank connection form ready for a new provider account. */
export const Blank = meta.story({});
```

`providers-page.stories.tsx`:

```tsx
import type { AccountsDocument } from '@recompose/contracts';

import preview from '#.storybook/preview';

import { ProvidersPage } from './providers-page';

const seeded: AccountsDocument = {
  schemaVersion: 1,
  accounts: [
    {
      id: 'a1',
      provider: 'anthropic',
      kind: 'subscription',
      label: 'Claude Max',
      credentialRef: 'c1',
    },
  ],
};

const meta = preview.meta({
  component: ProvidersPage,
});

/** The full providers screen with one connected account. */
export const Loaded = meta.story({
  parameters: { bridge: { accounts: seeded } },
});
```

Add JSDoc above the `AccountList`, `ConnectAccountForm`, and `ProvidersPage` exports in their component files, one line each describing purpose, following the Task 1 `TextField` example.

- [ ] **Step 5: Run the story project and the full suite**

Run: `pnpm --filter @recompose/desktop exec vitest run --project storybook && pnpm --filter @recompose/desktop run test`
Expected: `PASS`, nine story tests, thresholds met. An axe violation in a wired component gets fixed in the component, reported, and never waived.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/.storybook apps/desktop/src/renderer/src/pages/providers/ui apps/desktop/tsconfig.web.json
git commit -m "feat(desktop): wired stories over a typed fake bridge"
```

---

### Task 5: CI gate, smoke build and the story-required rule

**Files:**

- Modify: `.github/workflows/ci.yml` (the `check` job and the `meta` job)
- Modify: `.github/workflows/ruleset-bypass-audit.yml` (the label query)

**Interfaces:**

- Consumes: the `storybook:build` script from Task 1.
- Produces: the `stories-exempt` label contract that the Task 7 skill and Task 8 ADR document.

- [ ] **Step 1: Add the smoke step to the `check` job**

Directly after the `pnpm exec turbo run lint typecheck build test` step, add:

```yaml
- run: pnpm --filter @recompose/desktop run storybook:build
```

- [ ] **Step 2: Add the story rule to the `meta` job**

In the `meta` job's script, after the `tests_changed=` line and before `fail=0`, add:

```bash
          new_ui=$(grep '^added ' files.txt | awk '{print $2}' | grep -E '^apps/desktop/src/renderer/src/.*/ui/[^/]+\.tsx$' | grep -vE '\.(test|stories)\.tsx$' | head -1 || true)
          stories_changed=$(awk '{print $2}' files.txt | grep -E '\.stories\.tsx$' | head -1 || true)
```

After the existing `case "$pr_type" in ... esac` block, add:

```bash
          if [ -n "$new_ui" ] && [ -z "$stories_changed" ]; then
            if printf '%s' "$labels" | grep -qw 'stories-exempt' && printf '%s' "$body" | grep -q 'Stories-exempt:'; then
              echo "::notice::stories-exempt accepted; the weekly exemption audit lists this PR"
            else
              echo "::error::new renderer ui component ($new_ui) landed without a story. Every ui component ships a *.stories.tsx sibling. Escape: add the stories-exempt label plus a 'Stories-exempt: <reason>' line in the PR body."
              fail=1
            fi
          fi
```

The `grep -vE '\.(test|stories)\.tsx$'` filter also drops `*.browser.test.tsx` because the suffix still matches `.test.tsx`.

- [ ] **Step 3: Extend the weekly exemption audit**

In `.github/workflows/ruleset-bypass-audit.yml`, change the search label list:

```
label:tdd-exempt,adr-exempt
```

to:

```
label:tdd-exempt,adr-exempt,stories-exempt
```

- [ ] **Step 4: Create the label**

Run:

```bash
gh label create stories-exempt --description "story requirement bypassed, justification in the PR body" --color D93F0B
```

- [ ] **Step 5: Verify the rule logic locally**

Run this fixture check from the worktree root. Every line must print `ok`:

```bash
check() {
  files="$1"; labels="$2"; body="$3"; expected="$4"
  new_ui=$(printf '%s\n' "$files" | grep '^added ' | awk '{print $2}' | grep -E '^apps/desktop/src/renderer/src/.*/ui/[^/]+\.tsx$' | grep -vE '\.(test|stories)\.tsx$' | head -1 || true)
  stories_changed=$(printf '%s\n' "$files" | awk '{print $2}' | grep -E '\.stories\.tsx$' | head -1 || true)
  fail=0
  if [ -n "$new_ui" ] && [ -z "$stories_changed" ]; then
    if printf '%s' "$labels" | grep -qw 'stories-exempt' && printf '%s' "$body" | grep -q 'Stories-exempt:'; then
      fail=0
    else
      fail=1
    fi
  fi
  [ "$fail" = "$expected" ] && echo ok || echo "FAILED: $files"
}
check "added apps/desktop/src/renderer/src/pages/x/ui/widget.tsx" "" "" 1
check "added apps/desktop/src/renderer/src/pages/x/ui/widget.tsx
added apps/desktop/src/renderer/src/pages/x/ui/widget.stories.tsx" "" "" 0
check "added apps/desktop/src/renderer/src/pages/x/ui/widget.tsx" "stories-exempt" "Stories-exempt: canvas spike" 0
check "added apps/desktop/src/renderer/src/pages/x/ui/widget.browser.test.tsx" "" "" 0
check "modified apps/desktop/src/renderer/src/pages/x/ui/widget.tsx" "" "" 0
```

- [ ] **Step 6: Lint the workflows and commit**

Run: `mise exec -- zizmor .github/workflows/ci.yml .github/workflows/ruleset-bypass-audit.yml`
Expected: no findings.

```bash
git add .github/workflows/ci.yml .github/workflows/ruleset-bypass-audit.yml
git commit -m "ci: storybook build smoke and story-required meta rule"
```

The workflow edits trigger the ADR-presence rule, and ADR-0029 lands in this same pull request (Task 8).

---

### Task 6: The model context protocol server wired at project scope

**Files:**

- Modify: `.mcp.json`
- Modify: whatever files `claude plugin` writes at project scope (commit them as they land)

**Interfaces:**

- Consumes: the running Storybook from Task 1 (the `@storybook/addon-mcp` addon is already registered in `main.ts`).
- Produces: the `storybook` MCP server entry every project session picks up.

- [ ] **Step 1: Register the local MCP endpoint**

In `.mcp.json`, add alongside the existing servers:

```json
    "storybook": {
      "type": "http",
      "url": "http://localhost:6006/mcp"
    }
```

- [ ] **Step 2: Install the official plugin at project scope**

Run:

```bash
claude plugin marketplace add storybookjs/mcp@main --scope project
claude plugin install storybook@storybook --scope project
```

Commit whatever project files these commands change (`git status` shows them). If the `claude` binary is unavailable in your shell, report DONE_WITH_CONCERNS naming the two commands so the controller runs them.

- [ ] **Step 3: Verify the endpoint and the manifest**

Run Storybook in the background, then probe:

```bash
pnpm --filter @recompose/desktop run storybook &
sleep 20
curl -s http://localhost:6006/manifests/components.json | grep -c "text-field"
curl -s -o /dev/null -w "%{http_code}" http://localhost:6006/mcp
kill %1
```

Expected: the first `curl` prints a count of at least 1, and the second prints a status that isn't 404.

- [ ] **Step 4: Commit**

```bash
git add .mcp.json
git commit -m "feat: storybook mcp server registered at project scope"
```

Include the plugin-written files in the same commit when Step 2 produced them.

---

### Task 7: The storybook-stories skill

**Files:**

- Create: `.claude/skills/storybook-stories/SKILL.md`
- Modify: `CLAUDE.md`

**Interfaces:**

- Consumes: the decorator parameter shape from Task 4 and the label contract from Task 5.
- Produces: the authoring conventions later sessions follow.

- [ ] **Step 1: Write the skill**

`.claude/skills/storybook-stories/SKILL.md`:

```markdown
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
```

- [ ] **Step 2: Point `CLAUDE.md` at it**

In the `## Frontend (renderer) skills` section, add:

```markdown
- Use the `storybook-stories` skill when writing or reviewing any Storybook story, the Storybook config, or the fake bridge decorator.
```

- [ ] **Step 3: Gate-check and commit**

Run: `mise exec -- vale CLAUDE.md && pnpm exec cspell --no-progress CLAUDE.md .claude/skills/storybook-stories/SKILL.md`
Expected: both clean (the Vale glob excludes `.claude/skills`, cspell checks both). Add genuine new terms to `cspell-words.txt` alphabetically when flagged.

```bash
git add .claude/skills/storybook-stories/SKILL.md CLAUDE.md
git commit -m "docs: storybook-stories skill guides story authoring"
```

Include `cspell-words.txt` when touched.

---

### Task 8: The decision record and final verification

**Files:**

- Create: `docs/adr/0029-storybook-component-workshop.md`
- Modify: `docs/adr/README.md`

**Interfaces:**

- Consumes: everything shipped in Tasks 1 through 7.
- Produces: the job's decision record.

- [ ] **Step 1: Write ADR-0029 with the architecture-decision-records skill**

Read `.claude/skills/architecture-decision-records/SKILL.md` and match the format of `docs/adr/0028-security-baseline.md`. Capture, as decisions with rationale:

- Storybook 10.5 on `@storybook/react-vite` inside `apps/desktop`, CSF factories, and why the alternatives (a root workspace, a `packages/ui` extraction) lost.
- The Vite replication constraint: Storybook never reads `electron.vite.config.ts`, so `viteFinal` re-declares the alias and Tailwind plugin.
- The gate shape: story tests as a third Vitest project inside `pnpm test`, blocking axe checks, and the `storybook build` smoke step. lefthook runs no test job, so CI is the gate's home.
- The story-required meta-gate rule and its `stories-exempt` escape, riding the weekly exemption audit.
- The JSDoc exception to the no-comments rule: manifest documentation for agents.
- The MCP posture: `@storybook/addon-mcp` in the development server only, a project-scoped `.mcp.json` entry, and the official Claude Code plugin at project scope. The addon and manifests are experimental; both are development-time tools.
- The prose-gate scope change that rode this job: implementation plans under `docs/superpowers/plans/` left the Vale glob (in `package.json` and the CI `vale_flags`) and the cspell `ignorePaths`, as internal execution artifacts.
- The `EmptyState` extraction to `pages/home`, aligning the index route with the thin-adapter rule from ADR-0017.
- The theme toggle: `withThemeByClassName` flipping `color-scheme` classes because the tokens use `light-dark()`.

Add the index row to `docs/adr/README.md` following the existing table format.

- [ ] **Step 2: Gate-check the prose**

Run: `mise exec -- vale docs/adr/0029-storybook-component-workshop.md docs/adr/README.md && pnpm exec cspell --no-progress docs/adr/0029-storybook-component-workshop.md`
Expected: clean. Fix findings by rewriting, and add genuine terms to `cspell-words.txt`.

- [ ] **Step 3: Full verification**

Run:

```bash
pnpm exec turbo run lint typecheck build test
pnpm --filter @recompose/desktop run storybook:build
pnpm run lint:boundaries && pnpm run lint:fsd && pnpm run lint:dead && pnpm run lint:dup && pnpm run lint:spell
```

Expected: everything exits 0.

- [ ] **Step 4: Commit**

```bash
git add docs/adr/0029-storybook-component-workshop.md docs/adr/README.md
git commit -m "docs: record storybook decisions in ADR-0029"
```

Include `cspell-words.txt` when touched.
