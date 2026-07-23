# Typed IPC — Design

Date: 2026-07-23
Status: Approved

## Context

Sixth infrastructure-queue item. The storage foundation (ADR-0016) shipped main-process stores and a vault with no consumer; the router skeleton (ADR-0017) shipped screens with placeholder data. This job connects them: a narrow, typed, zod-validated IPC surface between main and renderer, and the renderer data layer that consumes it. Research favored a hand-rolled thin bridge over electron-trpc for a surface this small (type-safety without the transformer/indirection tax); the schemas already live in `packages/contracts`, so the channel contracts join them there. Security hardening (sandbox, CSP) is queue item 7, deliberately out of scope.

## Decisions

- **Channel contracts are the single source, in `packages/contracts`** (`src/ipc.ts`): each channel is a `{ request, response }` zod-schema pair; main handlers, the preload bridge, and renderer types all derive from it. v1 channels:

| Channel            | Request                             | Response                   |
| ------------------ | ----------------------------------- | -------------------------- |
| `gateways:list`    | void                                | `GatewayConfig[]`          |
| `gateways:save`    | `GatewayConfig`                     | updated `GatewayConfig[]`  |
| `settings:get`     | void                                | `Settings`                 |
| `settings:save`    | `Settings`                          | `Settings`                 |
| `accounts:list`    | void                                | `AccountsDocument`         |
| `accounts:connect` | `{ provider, kind, label, secret }` | updated `AccountsDocument` |
| `accounts:remove`  | `{ id }`                            | updated `AccountsDocument` |

- **No secret-read channel exists.** Plaintext lives only in main (and, later, the engine via in-memory handoff). `accounts:connect` carries the secret inbound exactly once: main generates `id` + `credentialRef`, encrypts into the vault, appends the account row, and returns the secret-free registry. `accounts:remove` deletes the vault entry and the account row together.
- **Validation at the boundary, both directions.** Every main handler parses its inbound payload with the contract's request schema (the renderer is attacker-reachable territory) and its outbound result with the response schema (symmetry is nearly free and keeps drift impossible).
- **Vault wiring closes its recorded debts** (storage-job ledger): the safeStorage codec is constructed after `app.whenReady` (Linux `unknown`-backend trap); encryption-unavailable / `basic_text` fallback is a typed, expected failure surfaced to the renderer as an error result, not a thrown surprise; `loadVaultFile`'s newer-schema throw is caught and mapped to a meaningful error.
- **Preload becomes the narrow bridge**: the commented, `@ts-ignore`'d scaffold is deleted; `window.recompose` exposes exactly the contract channels via `contextBridge`, typed from contracts in `index.d.ts`.
- **Renderer data layer: TanStack Query + router loaders** (user-locked). `QueryClient` lives in the app layer and enters the router context; route loaders warm caches with `ensureQueryData`; screens read with `useSuspenseQuery`; writes are mutations followed by `invalidateQueries`. Query/mutation definitions are page-local (`pages/<slice>/api/` segment) per Pages First — promoted only when a second consumer exists. The providers page becomes the first real consumer (accounts registry replaces its placeholder).
- **Query Devtools ride along** (user addition): `@tanstack/react-query-devtools` mounts dev-only with the same gating pattern as the router devtools (lazy, statically eliminated from production bundles, never loaded under vitest).

## Error model

Handler failures cross the bridge as structured results, not opaque rejections: contracts defines a channel-error shape (`{ code, message }` with codes such as `vault-unavailable`, `vault-newer-schema`, `validation-failed`, `storage-failed`) so the renderer can branch on `code`. Corrupt-file quarantine keeps its existing semantics (defaults returned, `onCorrupt` logged in main).

## Testing

- Contracts: channel schema round-trips and rejection cases (secret smuggling into responses must be structurally impossible — response schemas are strict and secret-free).
- Main: handlers are pure functions over injected stores/codec (real temp dirs, fake codec); `ipcMain.handle` registration is thin wiring, excluded like other boundary files.
- Renderer: Browser Mode specs drive loader → Query → screen with a fake `window.recompose` (the preload boundary is the sanctioned double), covering the providers page's list/connect/remove flows and error surfaces.

## Out of scope / deferred

- Engine channels and main→renderer push events: single-writer main means mutation-response + invalidation suffices today; push arrives with the engine.
- Gateway delete channel: no UI exists to drive it.
- Sandbox/CSP/security hardening: queue item 7.
- Promoting query definitions to shared layers: when a second consumer appears.

## Decision record

Recorded as ADR-0018 via the `architecture-decision-records` skill during implementation (contract-in-contracts, no-secret-read invariant, boundary validation both ways, Query-over-loaders layering). CLAUDE.md gains the `tanstack-query` skill rule once the skill is installed.
