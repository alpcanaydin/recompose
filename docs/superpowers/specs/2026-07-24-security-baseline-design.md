# Security baseline design

Date: 2026-07-24
Status: Approved

## Context

Seventh infrastructure-queue item. The typed Inter-Process Communication (IPC) surface recorded a residual (Architecture Decision Record (ADR) 0018). The packaged renderer loads over `file://`, so sender trust accepts a broad origin, and Electron recommends a custom protocol. The measured posture adds more gaps: `sandbox: false` in the window options, a Content Security Policy (CSP) that permits inline styles, no navigation guard, no permission handler, no Electron Fuses. The maintainer locked the two open design choices in a brainstorm: the custom scheme is `app://`, and external links open over `https` only.

## Decisions

- **Renderer sandbox turns on.** The preload uses only `contextBridge` and `ipcRenderer`, which the sandbox supports, so `sandbox: false` has no reason to exist. Every renderer runs sandboxed.
- **The packaged renderer loads over `app://`** through `protocol.handle`, registered as a standard, secure scheme before app readiness. The window loads `app://renderer/index.html`, and the handler serves only files inside the packaged renderer directory, rejecting traversal outside it. Development keeps the dev-server URL. The brand scheme `recompose://` stays free for future deep links.
- **Sender trust drops `file://` entirely.** Allowed origins become `app://renderer` plus the dev-server origin. This closes the residual from ADR-0018. A hostile `file://` document can no longer pass the origin check.
- **Navigation locks down.** A `will-navigate` handler denies any navigation away from the allowed origins and logs the attempt. The existing window-open denial stays, and its `shell.openExternal` call gains a scheme gate. An `https:` link opens in the browser, and the handler drops everything else with a log line. The maintainer chose the narrowest surface, so gateway URLs move through copy affordances rather than link-outs.
- **Permissions deny by default.** The session gets a permission request handler and a permission check handler that refuse everything, because today's renderer needs no Web permissions. Any future need lands as a visible allowlist entry.
- **Electron Fuses harden the packaged binary**: `runAsNode` off, Node options and Node inspect arguments off, cookie encryption on, embedded archive integrity validation on, and load-app-from-archive-only on. Applied at package time through the builder hook.
- **CSP tightens empirically.** The production policy drops `'unsafe-inline'` for styles if the built stylesheet works without it, measured during implementation; development keeps what hot reload needs. The policy stays a document meta tag, the standard mechanism for custom-scheme documents.
- **One one-shot audit rides along.** Electronegativity leaves the job entirely (unmaintained tool, maintainer's call). OpenSSF Scorecard runs once locally per the original queue rider: uncovered findings land in this job's decision record, and no action, schedule, or badge installs.

## Testing

- Sender-trust specs change behavior. An `app://renderer` main frame passes, a `file://` origin now fails, and the dev origin still passes. The Test-Driven Development (TDD) invariant applies, so behavior changes bring spec changes.
- The protocol handler gets path-traversal specs: a request escaping the renderer directory yields a rejection, not a file.
- The `openExternal` scheme gate and the navigation guard become pure functions with unit specs (allowed, denied, logged).
- Boot proof over Chrome DevTools Protocol (CDP) against the built application in `apps/desktop/out`: the window serves from `app://`, the frozen bridge still answers, a scripted navigation attempt away from the app fails, and the sandbox flag shows up in the process model. Packaged-artifact coverage lands with the future Playwright job.

## Out of scope

- Local Area Network (LAN) exposure and the API-token contract: engine-era work, already specified.
- Deep links and the `recompose://` scheme: no consumer exists yet.
- Any CSP reporting endpoint: offline-first, nothing phones home.

## Decision record

The team writes ADR-0028 with the architecture-decision-records skill during implementation. It captures the scheme choice and its sender-trust consequences, the sandbox rationale, the fuse set, and the permission stance. The `https`-only link-out and the Scorecard decision land there too.
