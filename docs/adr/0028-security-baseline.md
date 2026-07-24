# 0028: Security baseline: `app://` scheme, sandbox, fuses, deny-by-default

**Status**: Accepted
**Date**: 2026-07-24

## Context

Architecture Decision Record (ADR) 0018 recorded a residual. The packaged renderer loaded over `file://`, so Inter-Process Communication (IPC) sender trust accepted a broad origin. Electron's own guidance recommends a custom protocol instead. A wider measurement of the shipped posture turned up more gaps beside that residual. The window options carried `sandbox: false`. The Content Security Policy (CSP) allowed inline styles. The main window had no navigation guard. The default session had no permission handler. The packaged binary carried no Electron Fuses. This job, the seventh item on the control-gates queue, closes all these gaps in one pass. The maintainer locked two open design choices in a brainstorm before implementation started: the custom scheme is `app://`, and external links open over `https` only.

## Decision

- **The renderer sandbox turns on.** `apps/desktop/src/main/windows/window-options.ts` sets `webPreferences.sandbox: true` unconditionally. The preload script uses only `contextBridge` and `ipcRenderer`, both sandbox-compatible, so `sandbox: false` had no reason to exist.
- **The packaged renderer loads over `app://`.** `registerAppScheme` in `apps/desktop/src/main/protocol/app-protocol.ts` calls `protocol.registerSchemesAsPrivileged` before app readiness, marking `app` standard, secure, fetch-capable, and streamable. `serveRenderer` installs a `protocol.handle('app', ...)` callback that resolves each request against the packaged renderer directory and serves it through `net.fetch`. The window loads `app://renderer/index.html` in production and keeps the Vite dev-server URL in development. The brand scheme `recompose://` stays reserved and unregistered: no deep-link consumer exists yet.
- **The path resolver reads the raw request URL, not `url.pathname`.** The original design assumed `new URL(request.url).pathname` could feed a traversal check directly. That assumption didn't survive implementation. The WHATWG URL parser normalizes `pathname` first. It collapses `..` and URL-encoded dot segments (`%2e%2e`) before any check runs. A naive pathname-based guard would never see the traversal it exists to catch. The shipped resolver (`apps/desktop/src/main/protocol/renderer-path.ts`) takes a different path. It extracts the path from the raw URL text with a regex bounded at the first `?` or `#`. It decodes that text by hand and strips leading slashes. Only then does it resolve the result against the renderer root with `path.resolve`, rejecting anything that lands outside that root. The resolver treats a sequence that fails to decode as a traversal attempt (`rejected: 'traversal'`) instead of letting it throw, so malformed input fails closed.
- **Sender trust drops `file://` entirely.** `apps/desktop/src/main/ipc/sender-trust.ts` accepts only an `app://renderer` origin or the dev-server origin. This closes the ADR-0018 residual directly: a hostile `file://` document, previously a valid IPC sender, no longer passes `isTrustedOrigin`.
- **Navigation locks down.** `createMainWindow` in `apps/desktop/src/main/windows/main-window.ts` attaches a `will-navigate` listener that calls `isAllowedNavigation` (`apps/desktop/src/main/windows/navigation-policy.ts`). Anything outside the `app://renderer` origin or the dev-server origin gets `event.preventDefault()` and a logged warning. The existing window-open denial gains a scheme gate through `decideExternalOpen`. An `https:` target opens through `shell.openExternal`. The handler drops and logs everything else. The maintainer chose the narrowest possible surface, so gateway URLs move through copy affordances rather than link-outs.
- **Permissions deny by default.** `registerPermissionHandlers` in `apps/desktop/src/main/index.ts` installs both a permission request handler and a permission check handler on `session.defaultSession`, and both refuse unconditionally through `denyPermissionRequest`/`denyPermissionCheck`, because today's renderer needs no web permissions. A future need becomes a visible, reviewable allowlist entry instead of a silent grant.
- **Electron Fuses harden the packaged binary.** `apps/desktop/build/after-pack.cjs` flips six fuses at package time through `@electron/fuses`: `RunAsNode` off, `EnableNodeOptionsEnvironmentVariable` off, `EnableNodeCliInspectArguments` off, `EnableCookieEncryption` on, `EnableEmbeddedAsarIntegrityValidation` on, and `OnlyLoadAppFromAsar` on. Each fuse closes a specific escape from the packaged app back to a general Node.js runtime or an unsigned resource. `RunAsNode` off means the binary can't be re-invoked as a plain Node interpreter. The two Node-options fuses close code-injection routes into the main process, one driven by environment variables and one by CLI flags. Cookie encryption protects session storage at rest. Archive integrity validation and asar-only loading together stop the packaged app from executing code that comes from outside its signed archive.
- **`@electron/fuses` 2.1.3 ships as pure ECMAScript module output.** The package supports only the ECMAScript module format, with an `engines.node >=22.12` requirement. The `afterPack` hook that consumes it stays CommonJS, the hook contract electron-builder expects. It loads the package through Node's stable `require(esm)` interop rather than a dynamic `import()` shim. This repository's CI Node version already clears the 22.12 floor.
- **The CSP tightens empirically, not by assumption.** `apps/desktop/src/renderer/csp-policy.ts` builds a stricter policy for the packaged build than for development: production drops `'unsafe-inline'` from `style-src`, development keeps it because Vite's Hot Module Replacement (HMR) needs it. Dropping the allowance for production wasn't a paper decision. It followed empirical verification over the Chrome DevTools Protocol (CDP) against the built app, backed by a full static read of every renderer component, which turned up zero inline styles in today's tree. `injectContentSecurityPolicy` throws if the built `index.html` is missing the `__CSP__` placeholder the policy string replaces, so a broken injection point fails the build instead of shipping without a policy. One audit note distinct from the production result: in development, the React Fast Refresh preamble injects its `head-prepend` content before the CSP `meta` tag, so a dev session serving CSP-clean output is an artifact of Vite's injection order, not a guarantee the dev policy grants. The policy stays a document `meta` tag, the standard mechanism available to a custom-scheme document.
- **Electronegativity leaves the job entirely.** The tool has had no release since late 2024. Its maintained successor, ElectroNG, is a paid product. Carrying an unmaintained scanner forward would have meant depending on rules that stopped tracking Electron's own security advice. The maintainer's call: drop it rather than adopt a paid replacement for a one-shot audit.
- **OpenSSF Scorecard ran once, locally, as an audit.** No GitHub Actions workflow, cron schedule, or repository badge came out of this job. See Consequences for the harvested findings.

## Alternatives

- **`url.pathname`-based traversal checks**: the original design's approach. Rejected once implementation showed the WHATWG URL parser strips `..` segments before any application code can inspect them, which would make the check pass on inputs a naive reviewer would expect it to reject.
- **Keeping `file://` as the packaged origin**: the status quo ADR-0018 left open. Rejected: Electron's own IPC guidance treats a custom scheme as the correct fix for a broad trusted origin, and the sender-trust surface already depended on tightening it.
- **A CI-integrated Electronegativity scan**: considered as a continuation of the existing local-quality-gate pattern (ADR-0006). Rejected because the tool sits unmaintained. A security gate built on a scanner that no longer tracks new Electron advisories teaches false confidence.
- **Scorecard as a recurring CI gate with a badge**: the standard adoption path for the tool. Rejected for this job by the maintainer's original queue direction: a one-shot local audit harvests today's findings without taking on a recurring dependency on GitHub's API, a token, or a badge that implies ongoing monitoring this job doesn't set up.
- **Dynamic `import()` for `@electron/fuses` from the CommonJS hook**: would have worked but adds a promise-based load path to a build hook that electron-builder invokes synchronously in spirit. The stable `require(esm)` interop is simpler and needs no shim, given the Node floor already clears 22.12.

## Consequences

**Good**: the packaged app has no `file://` IPC sender left to exploit. The renderer process runs sandboxed. The navigation guard keeps the window on `app://` and refuses a redirect. External links can't smuggle a non-`https` scheme. The permission surface grants nothing without a future, explicit allowlist entry. The packaged binary has `runAsNode` and both Node.js CLI escapes fused off. Production styles run with no `'unsafe-inline'`, verified against the actual built output rather than assumed. The fuse read-back against a real packaged build, captured below, confirms the hook applies as designed instead of only in unit tests.

**Bad, and accepted**: the renderer resolver's URL-decode failure path fails closed as `traversal` rather than as a distinct decode-error state. A future maintainer reading only the type signature could mistake the two rejection reasons as equally serious. This record exists to tell them why. The parser genuinely can't separate the two failure modes in a way worth tracking. `EnableEmbeddedAsarIntegrityValidation` and `OnlyLoadAppFromAsar` together close a future loophole. Any future feature that expects to load a resource from outside the asar archive needs an explicit, reviewed exception, not a quiet code path. Electronegativity's departure means no automated Electron-specific scanner runs at all. That gap stays a maintainer follow-up, not a solved problem. The dev-mode CSP still allows inline styles. Its CDP-clean appearance during manual checks is incidental to Fast Refresh's injection order, not something a future contributor should rely on as policy.

**Scorecard audit, harvested findings.** The aggregate score is 6.7 out of 10, from a run against the repository's current commit on 2026-07-24. Scores range from `-1` (not applicable) through `10` (fully passing):

- `Vulnerabilities`: 10, zero known unfixed vulnerabilities detected.
- `Pinned-Dependencies`: 10, the build process pins every dependency.
- `Token-Permissions`: 10, GitHub Actions workflow tokens follow least privilege.
- `Dangerous-Workflow`: 10, no dangerous workflow patterns detected.
- `CI-Tests`: 10, all 30 checked merged pull requests ran a CI test.
- `Dependency-Update-Tool`: 10, an automated update tool is in place.
- `Binary-Artifacts`: 10, no committed binaries in the repository.
- `Fuzzing`: 10, Scorecard's JavaScript/TypeScript heuristic for this check recognizes `fast-check`, the property-based testing library this repository already uses per its testing rules, so this score reflects existing property tests rather than a dedicated fuzzing harness.
- `Branch-Protection`: 8, branch protection isn't yet maximal on every development and release branch.
- `Code-Review`: 4, 13 of the last 28 changesets Scorecard could inspect carried an approval.
- `Contributors`: 3, the project has contributors from one organization, expected for a project this young.
- `CII-Best-Practices`: 0, no OpenSSF Best Practices badge exists.
- `License`: 0, Scorecard didn't detect a license file at audit time.
- `Maintained`: 0, Scorecard's heuristic penalizes any repository created within the last 90 days regardless of actual commit activity; this repository was that young at audit time.
- `SAST`: 0, no static-application-security-testing tool runs on every commit today.
- `Security-Policy`: 0, no security policy file (`SECURITY.md`) exists yet.
- `Packaging`: not applicable, no packaging workflow exists (desktop app, not a published package).
- `Signed-Releases`: not applicable, no GitHub release exists yet to sign.

None of these findings triggers action inside this job. Per the maintainer's original queue direction, this run is a one-shot audit, not a gate. A maintainer picking up the lowest-scoring, cheapest findings later would start with a `SECURITY.md` policy file, a `LICENSE` file, and tighter branch protection. The `Maintained` and `Contributors` scores will improve on their own as the project ages past 90 days and gains outside contributors. Neither needs direct action. Re-running the audit takes a single command: `scorecard --repo github.com/<owner>/recompose` with a `GITHUB_AUTH_TOKEN` set in the environment. This repository's audit read that value from `gh auth token` and never committed it anywhere.

**Fuse read-back against a packaged build.** `pnpm --filter @recompose/desktop run build:mac` produced `apps/desktop/dist/mac-arm64/recompose.app`. This environment's later `dmg` packaging sub-step failed. The cause was an unrelated local Python `dmgbuild` temporary-file path issue. It surfaced only after the `.app` bundle and its `afterPack` fuse flip had already finished. Reading the fuses back with `pnpm --filter @recompose/desktop exec electron-fuses read --app dist/mac-arm64/recompose.app` reported:

```
Fuse Version: v1
  RunAsNode is Disabled
  EnableCookieEncryption is Enabled
  EnableNodeOptionsEnvironmentVariable is Disabled
  EnableNodeCliInspectArguments is Disabled
  EnableEmbeddedAsarIntegrityValidation is Enabled
  OnlyLoadAppFromAsar is Enabled
  LoadBrowserProcessSpecificV8Snapshot is Disabled
  GrantFileProtocolExtraPrivileges is Enabled
  WasmTrapHandlers is Enabled
```

All six fuses this job's hook sets match `fuseFlags` in `apps/desktop/build/after-pack.cjs` exactly. The remaining three fuses in the read-back (`LoadBrowserProcessSpecificV8Snapshot`, `GrantFileProtocolExtraPrivileges`, `WasmTrapHandlers`) are Electron's own defaults. This job's hook doesn't touch them, and this record makes no claim about them.
