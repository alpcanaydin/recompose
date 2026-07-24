# Typed inter-process communication: Design

Date: 2026-07-23
Status: Approved

## Context

Sixth infrastructure-queue item. The storage foundation shipped in Architecture Decision Record (ADR) ADR-0016: main-process stores and a vault with no consumer. The router skeleton shipped in ADR-0017: screens with placeholder data. This job connects them with a narrow, typed, zod-validated Inter-Process Communication (IPC) surface between main and renderer, plus the renderer data layer that consumes it. Research favored a hand-rolled thin bridge over electron-trpc for a surface this small, since it gives type safety without the transformer/indirection tax. The schemas already live in `packages/contracts`, so the channel contracts join them there. Security hardening, sandbox and Content Security Policy (CSP), is queue item 7, out of scope.

## Decisions

- **Channel contracts are the single source, in `packages/contracts`** (`src/ipc.ts`): each channel is a `{ request, response }` zod-schema pair. Main handlers, the preload bridge, and renderer types all derive from it. v1 channels:

| Channel            | Request                             | Response                   |
| ------------------ | ----------------------------------- | -------------------------- |
| `gateways:list`    | void                                | `GatewayConfig[]`          |
| `gateways:save`    | `GatewayConfig`                     | updated `GatewayConfig[]`  |
| `settings:get`     | void                                | `Settings`                 |
| `settings:save`    | `Settings`                          | `Settings`                 |
| `accounts:list`    | void                                | `AccountsDocument`         |
| `accounts:connect` | `{ provider, kind, label, secret }` | updated `AccountsDocument` |
| `accounts:remove`  | `{ id }`                            | updated `AccountsDocument` |

- **No secret-read channel exists.** The renderer's connect form necessarily holds the secret transiently before invoking the channel. The true invariant is narrower: the secret crosses the bridge exactly once inbound, is never returned on any channel, and at rest exists only in the vault (and, later, the engine via in-memory handoff). `accounts:connect` carries the secret inbound exactly once: main generates `id` + `credentialRef`, encrypts into the vault, appends the account row, and returns the secret-free registry. `accounts:remove` deletes the vault entry and the account row together.
- **Validation at the boundary, both directions.** Every main handler parses its inbound payload with the contract's request schema (the renderer is attacker-reachable territory) and its outbound result with the response schema (symmetry costs little and keeps drift impossible).
- **Sender validation before anything else** (mid-flight addition), in the testable dispatch layer, runs before any schema parsing. Every inbound invocation must originate from the app's own window's main frame. The dispatch layer null-checks `event.senderFrame`, since Electron may dispose frames, and matches its origin against the app's own origins (packaged `file://`, dev server URL). A foreign or disposed frame never reaches a handler. Rejection is an uninformative throw rather than a typed `forbidden-sender` result, since this repository's threat-model choice isn't something Electron's guidance dictates. Recorded in ADR-0018. CSP/sandbox hardening stays queue item 7.
- **Secret hygiene invariant**: the "fail with context" rule stops at the vault boundary. For every failure mode of `accounts:connect`, the serialized error result must not contain the secret string, and nothing on that channel's path logs the request payload. Proven by behavior specs, stated in ADR-0018 beside the no-secret-read rule.
- **The preload surface stays closed and enumerable**: the bridge exposes exactly the contract channels (derived from `ipcChannels`, no generic invoke passthrough, no extra members) and freezes the exposed object, and a renderer spec asserts `window.recompose`'s own keys equal the channel set exactly.
- **Vault wiring closes its recorded debts** (storage-job ledger): the app constructs the safeStorage codec after `app.whenReady` (Linux `unknown`-backend trap). The encryption-unavailable / `basic_text` fallback is a typed, expected failure surfaced to the renderer as an error result, not a thrown surprise. The code catches `loadVaultFile`'s newer-schema throw and maps it to a meaningful error.
- **Preload becomes the narrow bridge**: the commented, `@ts-ignore`'d scaffold goes away, and `window.recompose` exposes exactly the contract channels via `contextBridge`, typed from contracts in `index.d.ts`.
- **Renderer data layer: TanStack Query + router loaders** (user-locked). `QueryClient` lives in the app layer and enters the router context. Route loaders warm caches with `ensureQueryData`. Screens read with `useSuspenseQuery`. Writes are mutations followed by `invalidateQueries`. Query/mutation definitions are page-local (`pages/<slice>/api/` segment) per Pages First, promoted to shared layers only once a second consumer exists. The providers page becomes the first real consumer (accounts registry replaces its placeholder).
- **Query Devtools ride along** (user addition): `@tanstack/react-query-devtools` mounts dev-only with the same gating pattern as the router devtools (lazy, statically eliminated from production bundles, never loaded under vitest).

## Error model

Handler failures cross the bridge as structured results, not opaque rejections: contracts defines a channel-error shape (`{ code, message }` with codes such as `vault-unavailable`, `vault-newer-schema`, `validation-failed`, `storage-failed`) so the renderer can branch on `code`. Corrupt-file quarantine keeps its existing semantics (defaults returned, `onCorrupt` logged in main).

## Testing

- Contracts: channel schema round-trips and rejection cases (secret smuggling into responses must be structurally impossible, because response schemas are strict and secret-free).
- Main: handlers are pure functions over injected stores/codec (real temp dirs, fake codec). `ipcMain.handle` registration is thin wiring, excluded like other boundary files.
- Renderer: Browser Mode specs drive loader → Query → screen with a fake `window.recompose` (the preload boundary is the sanctioned double), covering the providers page's list/connect/remove flows and error surfaces.

## Out of scope / deferred

- Engine channels and main→renderer push events: single-writer main means mutation-response + invalidation suffices today. Push arrives with the engine.
- Gateway delete channel: no UI exists to drive it.
- Sandbox/CSP/security hardening: queue item 7.
- Promoting query definitions to shared layers: when a second consumer appears.
- Acceptance/E2E layer: decided at queue level as Gherkin `.feature` files executed via `playwright-bdd` (landing with the Playwright job). The providers list/connect/remove flows this job specs in Browser Mode become its future acceptance scenarios, and renderer specs stay behavior-named so they translate cleanly. Unit/integration specs remain plain Vitest per `.claude/rules/tdd-bdd.md` and stay outside Gherkin entirely.

## Decision record

Recorded as ADR-0018 via the `architecture-decision-records` skill during implementation (contract-in-contracts, no-secret-read invariant, boundary validation both ways, Query-over-loaders layering). CLAUDE.md gains the `tanstack-query` skill rule once the maintainer installs the skill.
