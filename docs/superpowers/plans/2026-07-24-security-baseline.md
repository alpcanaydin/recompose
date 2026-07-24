# Security baseline implementation plan

> **For agentic workers:** This plan requires the sub-skill superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement it task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the Electron shell. The packaged renderer loads over a custom `app://` scheme in a sandbox, and only trusted origins reach the Inter-Process Communication (IPC) surface. Navigation and external links stay locked down, permissions deny by default, and the packaged binary ships with Electron Fuses.

**Architecture:** The main process registers `app://` as a standard secure scheme before app readiness and serves the packaged renderer directory through a `protocol.handle` handler that rejects path traversal. Every navigation and window-open decision, every origin-trust check, and the fuse set live in pure functions with unit specs. Side effects (protocol registration, session handlers, the package-time fuse flip) sit at the edges and consume those pure functions. A local Playwright boot proof drives the built app over Chrome DevTools Protocol to confirm the wiring.

**Tech Stack:** Electron 43, `@electron/fuses`, Playwright `_electron` (already installed), Vitest with fast-check, electron-vite, electron-builder.

## Global Constraints

- **Never commit to `main`.** All work stays on branch `worktree-security-baseline` and lands through one Pull Request.
- **The repository owner's private alias must never appear** in any file, message, or artifact. The gitleaks `forbidden-owner-alias` rule enforces file contents.
- **No code comments.** Names and structure carry intent. The only exception is a constraint the code can't express.
- **Test-first, always:** red, green, refactor. One behavior per test. State-based assertions on observable outcomes, never call counts or private state. Test doubles only at real process boundaries.
- **The Test-Driven Development (TDD) invariant:** test code changes if and only if behavior changes. A pure refactor never touches a test.
- **Maximum-strictness TypeScript:** no `any`, no `as` casts to silence errors, no `@ts-ignore` or `@ts-expect-error` without an explaining comment.
- **Every commit uses Conventional Commits** through the caveman-commit skill and ends with the trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- **New dependencies pin the exact version** with `pnpm add -E`. If pnpm blocks the install under `minimumReleaseAge`, add the exact `name@version` to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`.
- **Authored markdown passes the gates:** the plan and the Architecture Decision Record (ADR) must pass Vale (Microsoft style at full strength) and cspell. No em dashes in prose. When a sentence reaches for an em dash, rewrite the sentence rather than swapping in a colon. Expand each acronym on first use. Headings are sentence case.
- **The custom scheme is `app://`** and its single host is `renderer`. External links open over `https` only. The brainstorm locked these two choices.

---

### Task 1: Renderer path resolver

**Files:**

- Create: `apps/desktop/src/main/protocol/renderer-path.ts`
- Test: `apps/desktop/src/main/protocol/renderer-path.test.ts`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `resolveRendererFile(rendererRoot: string, requestUrl: string): RendererFileResolution` where `RendererFileResolution = { filePath: string } | { rejected: 'not-app-scheme' | 'traversal' }`. Task 2 consumes this.

- [ ] **Step 1: Write the failing test**

```ts
import { join } from 'path';

import { describe, expect, test } from 'vitest';

import { resolveRendererFile } from './renderer-path';

const root = '/opt/recompose/out/renderer';

describe('resolving app:// requests to renderer files', () => {
  test('the root request maps to index.html', () => {
    expect(resolveRendererFile(root, 'app://renderer/')).toEqual({
      filePath: join(root, 'index.html'),
    });
  });

  test('a nested asset maps under the renderer root', () => {
    expect(resolveRendererFile(root, 'app://renderer/assets/app.js')).toEqual({
      filePath: join(root, 'assets/app.js'),
    });
  });

  test('a decoded parent-directory escape is rejected as traversal', () => {
    expect(resolveRendererFile(root, 'app://renderer/../secret')).toEqual({
      rejected: 'traversal',
    });
  });

  test('a percent-encoded parent-directory escape is rejected as traversal', () => {
    expect(resolveRendererFile(root, 'app://renderer/%2e%2e/%2e%2e/secret')).toEqual({
      rejected: 'traversal',
    });
  });

  test('a non-app scheme is rejected', () => {
    expect(resolveRendererFile(root, 'file:///etc/passwd')).toEqual({
      rejected: 'not-app-scheme',
    });
  });

  test('a foreign app host is rejected', () => {
    expect(resolveRendererFile(root, 'app://evil/index.html')).toEqual({
      rejected: 'not-app-scheme',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @recompose/desktop exec vitest run src/main/protocol/renderer-path.test.ts`
Expected: `FAIL` with a module-not-found error for `./renderer-path`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { resolve, sep } from 'path';

export type RendererFileResolution =
  { filePath: string } | { rejected: 'not-app-scheme' | 'traversal' };

const APP_SCHEME = 'app:';
const APP_HOST = 'renderer';

export function resolveRendererFile(
  rendererRoot: string,
  requestUrl: string,
): RendererFileResolution {
  const url = new URL(requestUrl);

  if (url.protocol !== APP_SCHEME || url.host !== APP_HOST) {
    return { rejected: 'not-app-scheme' };
  }

  const requestedPath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const relativePath = requestedPath === '' ? 'index.html' : requestedPath;

  const root = resolve(rendererRoot);
  const filePath = resolve(root, relativePath);

  if (!filePath.startsWith(root + sep)) {
    return { rejected: 'traversal' };
  }

  return { filePath };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @recompose/desktop exec vitest run src/main/protocol/renderer-path.test.ts`
Expected: `PASS`, six tests.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/main/protocol/renderer-path.ts apps/desktop/src/main/protocol/renderer-path.test.ts
git commit -m "feat(desktop): resolve app:// requests to renderer files"
```

---

### Task 2: The `app://` scheme registration and handler

**Files:**

- Create: `apps/desktop/src/main/protocol/app-protocol.ts`
- Modify: `apps/desktop/src/main/index.ts`
- Modify: `apps/desktop/src/main/windows/main-window.ts`

**Interfaces:**

- Consumes: `resolveRendererFile` from Task 1.
- Produces: `registerAppScheme(): void` (called at module load, before app readiness) and `serveRenderer(rendererRoot: string): void` (called after app readiness). The window loads `app://renderer/index.html` in production. Task 9 verifies this wiring.

This task has no unit test of its own. It's framework wiring around the Task 1 pure function, and the boot proof in Task 9 verifies it. The task-review gate treats the absence of a unit here as expected.

- [ ] **Step 1: Write the protocol module**

```ts
import { net, protocol } from 'electron';
import { pathToFileURL } from 'url';

import { resolveRendererFile } from './renderer-path';

export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
  ]);
}

export function serveRenderer(rendererRoot: string): void {
  protocol.handle('app', async (request) => {
    const resolution = resolveRendererFile(rendererRoot, request.url);

    if ('rejected' in resolution) {
      return new Response(null, { status: resolution.rejected === 'traversal' ? 403 : 400 });
    }

    return net.fetch(pathToFileURL(resolution.filePath).toString());
  });
}
```

- [ ] **Step 2: Register the scheme before readiness and serve after it in `index.ts`**

Add the import near the other main-process imports:

```ts
import { registerAppScheme, serveRenderer } from './protocol/app-protocol';
```

Add `join` to the `path` import if it's not already present:

```ts
import { join } from 'path';
```

Call `registerAppScheme()` at module scope, immediately after the imports and before `app.whenReady()`:

```ts
registerAppScheme();
```

Inside the `app.whenReady().then(...)` callback, before `createMainWindow()`, serve the renderer:

```ts
serveRenderer(join(__dirname, '../renderer'));
```

- [ ] **Step 3: Load the app scheme in production from `main-window.ts`**

Replace the production `loadFile` branch so both branches use `loadURL`:

```ts
if (is.dev && rendererUrl !== undefined && rendererUrl !== '') {
  void mainWindow.loadURL(rendererUrl);
} else {
  void mainWindow.loadURL('app://renderer/index.html');
}
```

Remove the now-unused `join` import from `main-window.ts` only if nothing else in the file uses it (the preload path still uses `join`, so keep it).

- [ ] **Step 4: Typecheck and build**

Run: `pnpm --filter @recompose/desktop run typecheck && pnpm --filter @recompose/desktop run build`
Expected: both succeed, no type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/main/protocol/app-protocol.ts apps/desktop/src/main/index.ts apps/desktop/src/main/windows/main-window.ts
git commit -m "feat(desktop): serve packaged renderer over app:// scheme"
```

---

### Task 3: Sender trust drops `file://` and adds `app://renderer`

**Files:**

- Modify: `apps/desktop/src/main/ipc/sender-trust.ts`
- Modify: `apps/desktop/src/main/ipc/sender-trust.test.ts`

**Interfaces:**

- Consumes: nothing new. The exported `assertTrustedSender(sender, allowed)` and its types stay unchanged in shape.
- Produces: the same public surface with new behavior. The check trusts an `app://renderer` main frame and turns away a `file://` frame.

This is a behavior change, so the specs change with it. The TDD invariant holds.

- [ ] **Step 1: Rewrite the affected tests**

Replace the accepted-`file://` test and add the rejected-`file://` test. The dev-origin tests stay unchanged.

```ts
describe('sender trust: accepted senders', () => {
  test('the packaged app main frame (app://renderer) is trusted', () => {
    const sender: TrustedSender = { frameUrl: 'app://renderer/index.html', isMainFrame: true };

    expect(() => {
      assertTrustedSender(sender, noDevOrigin);
    }).not.toThrow();
  });

  test('the dev server main frame is trusted when its origin is allowed', () => {
    const sender: TrustedSender = { frameUrl: 'http://localhost:5173/', isMainFrame: true };

    expect(() => {
      assertTrustedSender(sender, devOrigins);
    }).not.toThrow();
  });
});
```

Add this test inside the `describe('sender trust: rejected senders', ...)` block:

```ts
test('a file:// main frame is now rejected', () => {
  const sender: TrustedSender = {
    frameUrl: 'file:///Applications/recompose.app/renderer/index.html',
    isMainFrame: true,
  };

  expect(() => {
    assertTrustedSender(sender, noDevOrigin);
  }).toThrow();
});
```

- [ ] **Step 2: Run tests to verify the new behavior fails**

Run: `pnpm --filter @recompose/desktop exec vitest run src/main/ipc/sender-trust.test.ts`
Expected: `FAIL`. The `app://renderer` case throws (not yet trusted) and the `file://` case doesn't throw (still trusted).

- [ ] **Step 3: Update the trust check**

Replace `isTrustedOrigin` in `sender-trust.ts`:

```ts
const APP_SCHEME = 'app:';
const APP_HOST = 'renderer';

function isTrustedOrigin(frameUrl: string, allowed: AllowedOrigins): boolean {
  const url = new URL(frameUrl);

  if (url.protocol === APP_SCHEME && url.host === APP_HOST) {
    return true;
  }

  return allowed.devServerOrigin !== undefined && url.origin === allowed.devServerOrigin;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @recompose/desktop exec vitest run src/main/ipc/sender-trust.test.ts`
Expected: `PASS`.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/main/ipc/sender-trust.ts apps/desktop/src/main/ipc/sender-trust.test.ts
git commit -m "feat(desktop): trust app://renderer and reject file:// senders"
```

---

### Task 4: Renderer sandbox turns on

**Files:**

- Modify: `apps/desktop/src/main/windows/window-options.ts`
- Modify: `apps/desktop/src/main/windows/window-options.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `windowOptionsFor(...)` returns `webPreferences.sandbox === true`.

- [ ] **Step 1: Change the two sandbox assertions in the test**

In `window-options.test.ts`, the property-based contract test asserts `sandbox`. Change it from `false` to `true`:

```ts
expect(options.webPreferences?.sandbox).toBe(true);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @recompose/desktop exec vitest run src/main/windows/window-options.test.ts`
Expected: `FAIL`. The contract test reports `sandbox` is `false`.

- [ ] **Step 3: Flip the flag**

In `window-options.ts`:

```ts
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
    },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @recompose/desktop exec vitest run src/main/windows/window-options.test.ts`
Expected: `PASS`.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/main/windows/window-options.ts apps/desktop/src/main/windows/window-options.test.ts
git commit -m "feat(desktop): run the renderer sandboxed"
```

---

### Task 5: Navigation guard and https-only external links

**Files:**

- Create: `apps/desktop/src/main/environment/dev-server-origin.ts`
- Create: `apps/desktop/src/main/windows/navigation-policy.ts`
- Create: `apps/desktop/src/main/windows/navigation-policy.test.ts`
- Modify: `apps/desktop/src/main/ipc/register-ipc.ts`
- Modify: `apps/desktop/src/main/windows/main-window.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces:
  - `devServerOrigin(): string | undefined` in `environment/dev-server-origin.ts`, shared by the IPC layer and the window layer.
  - `isAllowedNavigation(targetUrl: string, policy: NavigationPolicy): boolean` where `NavigationPolicy = { devServerOrigin: string | undefined }`.
  - `decideExternalOpen(targetUrl: string): 'open-https' | 'drop'`.

Pulling `devServerOrigin` out of `register-ipc.ts` is a pure refactor. Behavior doesn't change, so no IPC test changes.

- [ ] **Step 1: Split out the shared dev-server origin helper**

Create `apps/desktop/src/main/environment/dev-server-origin.ts`:

```ts
export function devServerOrigin(): string | undefined {
  const { ELECTRON_RENDERER_URL: rendererUrl } = process.env;

  return rendererUrl === undefined || rendererUrl === '' ? undefined : new URL(rendererUrl).origin;
}
```

In `register-ipc.ts`, delete the local `devServerOrigin` function and import the shared one:

```ts
import { devServerOrigin } from '../environment/dev-server-origin';
```

- [ ] **Step 2: Write the failing navigation-policy test**

Create `apps/desktop/src/main/windows/navigation-policy.test.ts`:

```ts
import { describe, expect, test } from 'vitest';

import {
  decideExternalOpen,
  isAllowedNavigation,
  type NavigationPolicy,
} from './navigation-policy';

const devPolicy: NavigationPolicy = { devServerOrigin: 'http://localhost:5173' };
const prodPolicy: NavigationPolicy = { devServerOrigin: undefined };

describe('in-window navigation policy', () => {
  test('navigation to the app scheme is allowed', () => {
    expect(isAllowedNavigation('app://renderer/settings', prodPolicy)).toBe(true);
  });

  test('navigation to the dev server is allowed when configured', () => {
    expect(isAllowedNavigation('http://localhost:5173/settings', devPolicy)).toBe(true);
  });

  test('navigation to a foreign origin is denied', () => {
    expect(isAllowedNavigation('https://evil.example.com', prodPolicy)).toBe(false);
  });

  test('a malformed target is denied', () => {
    expect(isAllowedNavigation('not a url', prodPolicy)).toBe(false);
  });
});

describe('external-open policy', () => {
  test('an https link opens externally', () => {
    expect(decideExternalOpen('https://recompose.sh')).toBe('open-https');
  });

  test('a non-https link is dropped', () => {
    expect(decideExternalOpen('http://recompose.sh')).toBe('drop');
  });

  test('a malformed target is dropped', () => {
    expect(decideExternalOpen('javascript:alert(1)')).toBe('drop');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @recompose/desktop exec vitest run src/main/windows/navigation-policy.test.ts`
Expected: `FAIL` with a module-not-found error for `./navigation-policy`.

- [ ] **Step 4: Write the navigation-policy module**

Create `apps/desktop/src/main/windows/navigation-policy.ts`:

```ts
export type NavigationPolicy = { devServerOrigin: string | undefined };

const APP_SCHEME = 'app:';
const APP_HOST = 'renderer';

export function isAllowedNavigation(targetUrl: string, policy: NavigationPolicy): boolean {
  if (!URL.canParse(targetUrl)) {
    return false;
  }

  const url = new URL(targetUrl);

  if (url.protocol === APP_SCHEME && url.host === APP_HOST) {
    return true;
  }

  return policy.devServerOrigin !== undefined && url.origin === policy.devServerOrigin;
}

export type ExternalOpenDecision = 'open-https' | 'drop';

export function decideExternalOpen(targetUrl: string): ExternalOpenDecision {
  if (!URL.canParse(targetUrl)) {
    return 'drop';
  }

  return new URL(targetUrl).protocol === 'https:' ? 'open-https' : 'drop';
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @recompose/desktop exec vitest run src/main/windows/navigation-policy.test.ts`
Expected: `PASS`.

- [ ] **Step 6: Wire both guards into the window**

In `main-window.ts`, add the imports:

```ts
import { devServerOrigin } from '../environment/dev-server-origin';
import {
  decideExternalOpen,
  isAllowedNavigation,
  type NavigationPolicy,
} from './navigation-policy';
```

Inside `createMainWindow`, once the window exists, build the policy and register the guards. Replace the existing `setWindowOpenHandler` block with the scheme-gated version and add the `will-navigate` guard:

```ts
const navigationPolicy: NavigationPolicy = { devServerOrigin: devServerOrigin() };

mainWindow.webContents.on('will-navigate', (event, url) => {
  if (!isAllowedNavigation(url, navigationPolicy)) {
    event.preventDefault();
    console.warn(`blocked navigation to ${url}`);
  }
});

mainWindow.webContents.setWindowOpenHandler((details) => {
  if (decideExternalOpen(details.url) === 'open-https') {
    void shell.openExternal(details.url);
  } else {
    console.warn(`dropped window-open to ${details.url}`);
  }

  return { action: 'deny' };
});
```

- [ ] **Step 7: Typecheck, then run the full desktop suite**

Run: `pnpm --filter @recompose/desktop run typecheck && pnpm --filter @recompose/desktop test`
Expected: `PASS`, including the unchanged IPC tests (confirming the `devServerOrigin` extraction was a pure refactor).

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/main/environment/dev-server-origin.ts apps/desktop/src/main/windows/navigation-policy.ts apps/desktop/src/main/windows/navigation-policy.test.ts apps/desktop/src/main/ipc/register-ipc.ts apps/desktop/src/main/windows/main-window.ts
git commit -m "feat(desktop): guard navigation and open only https links"
```

---

### Task 6: Permissions deny by default

**Files:**

- Create: `apps/desktop/src/main/windows/permission-policy.ts`
- Create: `apps/desktop/src/main/windows/permission-policy.test.ts`
- Modify: `apps/desktop/src/main/index.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `denyPermissionRequest(): false` and `denyPermissionCheck(): false`, wired into `session.defaultSession`.

These are security-load-bearing constants, so each keeps one runnable check.

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/src/main/windows/permission-policy.test.ts`:

```ts
import { describe, expect, test } from 'vitest';

import { denyPermissionCheck, denyPermissionRequest } from './permission-policy';

describe('permission policy denies everything by default', () => {
  test('a permission request is denied', () => {
    expect(denyPermissionRequest()).toBe(false);
  });

  test('a permission check is denied', () => {
    expect(denyPermissionCheck()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @recompose/desktop exec vitest run src/main/windows/permission-policy.test.ts`
Expected: `FAIL` with a module-not-found error for `./permission-policy`.

- [ ] **Step 3: Write the module**

Create `apps/desktop/src/main/windows/permission-policy.ts`:

```ts
export function denyPermissionRequest(): false {
  return false;
}

export function denyPermissionCheck(): false {
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @recompose/desktop exec vitest run src/main/windows/permission-policy.test.ts`
Expected: `PASS`.

- [ ] **Step 5: Wire the handlers in `index.ts`**

Add `session` to the electron import:

```ts
import { app, BrowserWindow, safeStorage, session } from 'electron';
```

Add the policy import:

```ts
import { denyPermissionCheck, denyPermissionRequest } from './windows/permission-policy';
```

Inside `app.whenReady().then(...)`, before `createMainWindow()`, register both handlers:

```ts
session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
  callback(denyPermissionRequest());
});
session.defaultSession.setPermissionCheckHandler(() => denyPermissionCheck());
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @recompose/desktop run typecheck`
Expected: `PASS`.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/main/windows/permission-policy.ts apps/desktop/src/main/windows/permission-policy.test.ts apps/desktop/src/main/index.ts
git commit -m "feat(desktop): deny web permissions by default"
```

---

### Task 7: Electron Fuses at package time

**Files:**

- Create: `apps/desktop/build/after-pack.cjs`
- Modify: `apps/desktop/electron-builder.yml`
- Modify: `apps/desktop/package.json` (new devDependency)
- Modify: `.oxlintrc.json` (exclude build tooling from the type-aware lint)
- Modify: `pnpm-workspace.yaml` (only if release age blocks the install)

**Interfaces:**

- Consumes: `@electron/fuses` (a CommonJS package).
- Produces: an `afterPack` hook that flips the packaged binary's fuses at package time.

The fuse flip is a package-time side effect against a real binary. Because `@electron/fuses` ships as CommonJS, the hook is a self-contained CommonJS module at the edge of the system. It's not application code, so it stays out of the type-aware lint alongside the other build tooling. The spec lists no fuse unit test. The genuine regression check reads the fuses back off the packaged binary in Task 10, which inspects the real artifact rather than a copy of the constants.

- [ ] **Step 1: Install the dependency**

```bash
pnpm --filter @recompose/desktop add -E -D @electron/fuses
```

Expected: `@electron/fuses` appears in `apps/desktop/package.json` `devDependencies` with an exact version. If pnpm refuses the install because the version is younger than the release-age floor, add the exact `@electron/fuses@<version>` line to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` and re-run.

- [ ] **Step 2: Exclude build tooling from the lint**

In `.oxlintrc.json`, add `"apps/desktop/build/**"` to the `ignorePatterns` array. Build hooks run at package time against untyped electron-builder context and a CommonJS dependency, so the type-aware unsafe rules don't fit them.

- [ ] **Step 3: Write the afterPack hook**

Create `apps/desktop/build/after-pack.cjs`:

```js
const { FuseV1Options, FuseVersion, flipFuses } = require('@electron/fuses');
const { join } = require('node:path');

const fuseFlags = {
  [FuseV1Options.RunAsNode]: false,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  [FuseV1Options.EnableNodeCliInspectArguments]: false,
  [FuseV1Options.EnableCookieEncryption]: true,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  [FuseV1Options.OnlyLoadAppFromAsar]: true,
};

const binaryPath = {
  darwin: (dir, name) => join(dir, `${name}.app`, 'Contents', 'MacOS', name),
  win32: (dir, name) => join(dir, `${name}.exe`),
  linux: (dir, name) => join(dir, name),
};

module.exports = async function afterPack(context) {
  const { appOutDir, electronPlatformName, packager } = context;
  const target = binaryPath[electronPlatformName](appOutDir, packager.appInfo.productFilename);

  await flipFuses(target, {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: electronPlatformName === 'darwin',
    ...fuseFlags,
  });
};
```

- [ ] **Step 4: Register the hook in electron-builder**

In `apps/desktop/electron-builder.yml`, add the top-level key:

```yaml
afterPack: ./build/after-pack.cjs
```

- [ ] **Step 5: Confirm the lint and typecheck stay green**

Run: `pnpm --filter @recompose/desktop run typecheck && pnpm exec oxlint`
Expected: both pass, and oxlint doesn't report the new hook because the ignore list now covers it.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/build/after-pack.cjs apps/desktop/electron-builder.yml apps/desktop/package.json .oxlintrc.json pnpm-workspace.yaml
git commit -m "feat(desktop): flip electron fuses at package time"
```

---

### Task 8: Tighten the content security policy

**Files:**

- Create: `apps/desktop/src/renderer/csp-policy.ts`
- Create: `apps/desktop/src/renderer/csp-policy.test.ts`
- Modify: `apps/desktop/src/renderer/index.html`
- Modify: `apps/desktop/electron.vite.config.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `contentSecurityPolicy(mode: 'serve' | 'build'): string`. Development keeps inline styles for hot reload. Production drops them.

The Content Security Policy (CSP) is a static document meta tag, so a build-time transform swaps in the strict production string. Keeping the policy in a pure function lets a spec pin both variants.

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/src/renderer/csp-policy.test.ts`:

```ts
import { describe, expect, test } from 'vitest';

import { contentSecurityPolicy } from './csp-policy';

describe('content security policy per build mode', () => {
  test('production forbids inline styles', () => {
    const policy = contentSecurityPolicy('build');

    expect(policy).toContain("style-src 'self'");
    expect(policy).not.toContain("'unsafe-inline'");
  });

  test('development allows inline styles for hot reload', () => {
    const policy = contentSecurityPolicy('serve');

    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
  });

  test('both modes keep the default and script sources locked to self', () => {
    for (const mode of ['serve', 'build'] as const) {
      const policy = contentSecurityPolicy(mode);

      expect(policy).toContain("default-src 'self'");
      expect(policy).toContain("script-src 'self'");
      expect(policy).toContain("img-src 'self' data:");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @recompose/desktop exec vitest run src/renderer/csp-policy.test.ts`
Expected: `FAIL` with a module-not-found error for `./csp-policy`.

- [ ] **Step 3: Write the policy module**

Create `apps/desktop/src/renderer/csp-policy.ts`:

```ts
export function contentSecurityPolicy(mode: 'serve' | 'build'): string {
  const styleSrc = mode === 'serve' ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'";

  return ["default-src 'self'", "script-src 'self'", styleSrc, "img-src 'self' data:"].join('; ');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @recompose/desktop exec vitest run src/renderer/csp-policy.test.ts`
Expected: `PASS`.

- [ ] **Step 5: Replace the CSP meta content with a placeholder**

In `apps/desktop/src/renderer/index.html`, replace the meta tag content with a placeholder and drop the stale comment:

```html
<meta http-equiv="Content-Security-Policy" content="__CSP__" />
```

- [ ] **Step 6: Add the transform plugin in `electron.vite.config.ts`**

Add the import:

```ts
import { contentSecurityPolicy } from './src/renderer/csp-policy';
```

Define the plugin and add it to the renderer plugin list, before `react()`:

```ts
function cspTransform() {
  return {
    name: 'recompose-csp',
    transformIndexHtml(html: string, ctx: { server?: unknown }) {
      const mode = ctx.server === undefined ? 'build' : 'serve';

      return html.replace('__CSP__', contentSecurityPolicy(mode));
    },
  };
}
```

Add `cspTransform()` to the `plugins` array.

- [ ] **Step 7: Measure development and production empirically**

Run development and confirm the console shows no CSP violation:

Run: `pnpm --filter @recompose/desktop run dev`
Expected: the window renders styled, no CSP error in the console. Stop with ctrl-c.

Build and preview the production bundle and confirm the styles load under the strict policy:

Run: `pnpm --filter @recompose/desktop run build && pnpm --filter @recompose/desktop start`
Expected: the window renders styled, no CSP error. If production reports a blocked inline style, record the finding in Task 10 and widen only the production `style-src` by the minimum needed, updating the test to match.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/renderer/csp-policy.ts apps/desktop/src/renderer/csp-policy.test.ts apps/desktop/src/renderer/index.html apps/desktop/electron.vite.config.ts
git commit -m "feat(desktop): drop inline-style CSP allowance in production"
```

---

### Task 9: Boot proof over Chrome DevTools Protocol

**Files:**

- Create: `apps/desktop/e2e/security-boot-proof.mjs`
- Modify: `.oxlintrc.json` (exclude the end-to-end harness from the type-aware lint)

**Interfaces:**

- Consumes: the built app in `apps/desktop/out`, Playwright `_electron` (already a devDependency).
- Produces: a runnable local proof. It stays out of Continuous Integration (CI). The packaged macOS smoke test belongs to the future Playwright job, so this stays a local, one-shot artifact that Task 10 captures.

- [ ] **Step 1: Exclude the end-to-end harness from the lint**

In `.oxlintrc.json`, add `"apps/desktop/e2e/**"` to the `ignorePatterns` array. The proof drives a real Electron process through Playwright and reaches into the untyped process model, so the type-aware unsafe rules don't fit it. The future Playwright job owns the end-to-end lint configuration.

- [ ] **Step 2: Write the boot-proof script**

Create `apps/desktop/e2e/security-boot-proof.mjs`:

```js
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { _electron as electron } from 'playwright';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const app = await electron.launch({
  args: [appRoot],
  env: { ...process.env, NODE_ENV: 'production', ELECTRON_RENDERER_URL: '' },
});

const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');

const served = new URL(page.url());
assert.equal(served.protocol, 'app:');
assert.equal(served.host, 'renderer');

const bridgeFrozen = await page.evaluate(() => Object.isFrozen(globalThis.recompose));
assert.equal(bridgeFrozen, true);

const sandboxed = await app.evaluate(
  ({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences().sandbox,
);
assert.equal(sandboxed, true);

await page.evaluate(() => {
  globalThis.location.href = 'https://example.com/';
});
await page.waitForTimeout(500);
assert.equal(new URL(page.url()).protocol, 'app:');

await app.close();
console.log('security boot proof passed');
```

- [ ] **Step 3: Build, then run the proof**

Run: `pnpm --filter @recompose/desktop run build && node apps/desktop/e2e/security-boot-proof.mjs`
Expected: `security boot proof passed`. If the environment has no display and the launch fails, record the blocker in the task report. Defer the run to Task 10, where the maintainer runs it against the packaged app.

- [ ] **Step 4: Confirm the lint ignores the harness**

Run: `pnpm exec oxlint`
Expected: pass, with no report against `apps/desktop/e2e/security-boot-proof.mjs`.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/e2e/security-boot-proof.mjs .oxlintrc.json
git commit -m "test(desktop): boot proof for app:// sandbox and navigation guard"
```

---

### Task 10: Decision record and one-shot audit

**Files:**

- Create: `docs/adr/0028-security-baseline.md`
- Modify: `docs/adr/README.md`

**Interfaces:**

- Consumes: the decisions from Tasks 1 through 9.
- Produces: ADR-0028 and the audit findings.

- [ ] **Step 1: Write the ADR with the skill**

Invoke the architecture-decision-records skill. Write `docs/adr/0028-security-baseline.md` in the house format (`# 0028: ...`, `**Status**: Accepted`, `**Date**: 2026-07-24`, then Context, Decision, Alternatives, Consequences). Capture each decision:

- the `app://` scheme choice, which closes the `file://` residual from ADR-0018 in sender trust
- `recompose://` stays reserved for future deep links
- the sandbox rationale
- the fuse set and why each fuse
- the deny-by-default permission stance
- the https-only external-link policy
- the empirical CSP result from Task 8

Record that Electronegativity left the job as an unmaintained tool. Note that OpenSSF Scorecard ran once as a local audit with no action, schedule, or badge installed.

- [ ] **Step 2: Run the one-shot OpenSSF Scorecard audit**

Run Scorecard once against the repository (for example `scorecard --repo github.com/<owner>/recompose` with a token, or the containerized equivalent). Harvest the uncovered findings into the ADR Consequences section. If no network or token is available in this environment, record that the run is a maintainer follow-up and note the intended checks, then continue.

- [ ] **Step 3: Verify the fuses on a packaged binary**

Build the packaged app and read back the fuse state:

Run: `pnpm --filter @recompose/desktop run build:mac`
Then: `pnpm --filter @recompose/desktop exec electron-fuses read --app apps/desktop/dist/mac*/recompose.app`
Expected: the six fuses match `fuseFlags`. Paste the summary into the ADR. If packaging isn't feasible in this environment, record it as a maintainer follow-up.

- [ ] **Step 4: Add the ADR to the index**

Add a row to the table in `docs/adr/README.md`:

```markdown
| [0028](0028-security-baseline.md) | Security Baseline: app:// Scheme, Sandbox, Fuses, Deny-by-Default | Accepted | 2026-07-24 |
```

- [ ] **Step 5: Gate-check the prose**

Run: `mise exec -- vale docs/adr/0028-security-baseline.md docs/adr/README.md docs/superpowers/plans/2026-07-24-security-baseline.md`
Then: `pnpm exec cspell "docs/adr/0028-security-baseline.md" "docs/superpowers/plans/2026-07-24-security-baseline.md"`
Expected: both clean. Add any genuine new domain terms to `cspell-words.txt` and rewrite any em-dash sentence rather than patching it with a colon.

- [ ] **Step 6: Commit**

```bash
git add docs/adr/0028-security-baseline.md docs/adr/README.md cspell-words.txt
git commit -m "docs: record security baseline decisions in ADR-0028"
```
