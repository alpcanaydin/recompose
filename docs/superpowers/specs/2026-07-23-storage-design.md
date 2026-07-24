# Storage architecture: Design

Date: 2026-07-23
Status: Approved

## Context

Fourth infrastructure-queue item. recompose is local and offline-first: no cloud, no signup. Four kinds of data need persistence, each with a different character. Gateway configs are the canvas graph the whole product revolves around. Provider secrets cover API keys and subscription tokens. App settings round out the small state. Request/usage logs feed the Usage drawer's 24h spend chart, tok/min chip, and per-provider bars. Two consumers beyond the renderer bind the design. The gateway engine runs in a `utilityProcess` with zero `electron` imports and **outlives the app window** (locked 2026-07-21). A future headless CLI must also reuse the same storage without Electron.

## Decisions (user-locked)

- **Gateway configs are JSON files**: one file per gateway under `userData/gateways/<slug>.json`, zod-validated, containing virtual models, router chains, targets, provider-account references, and a canvas-layout section. The file is the same truth the canvas toolbar's "Edit-as-JSON" button shows. It's human-readable, exportable, and git-able. Secrets never appear in it, because accounts point into the vault via `credentialRef` instead.
- **Secrets live in a safeStorage vault with in-memory handoff.** `userData/vault.bin` holds a map of `credentialRef → safeStorage-encrypted value` (macOS Keychain / Windows Data Protection (DPAPI) / Linux libsecret as the key source). Only the Electron main process decrypts. Decrypted secrets then travel to the engine **by message** at spawn and on change. The engine keeps them in memory and never writes a secret to disk. When the app quits, the detached engine continues with what it holds. It can't be respawned without the app (the app is its supervisor, an accepted trade-off). A separate Architecture Decision Record (ADR) will cover headless CLI secret access.
- **Usage logs are `node:sqlite`**: `userData/usage.db`, owned and written exclusively by the engine. Node's built-in SQLite means zero native dependencies, no per-Electron rebuild, and identical code in the future headless CLI. Fallback recorded up front: if the Electron 43 Node runtime's `node:sqlite` proves unstable at implementation time, `better-sqlite3` is the substitute (mature, but native-rebuild-coupled).
- **App settings are one small JSON**: `userData/settings.json` (theme, window, engine port). No settings library: electron-store has no active maintainer. A zod-validated file read/write is sufficient.

## File layout

```text
<userData>/
├─ gateways/<slug>.json   single gateway config + canvas layout, schemaVersion'd
├─ accounts.json          provider-account registry (label, provider, kind, credentialRef), schemaVersion'd
├─ settings.json          app preferences, schemaVersion'd
├─ vault.bin              safeStorage-encrypted secret map
└─ usage.db               node:sqlite, engine-owned request/usage log
```

Accounts are cross-gateway entities (one subscription serves many gateways), so they live in their own registry. Gateway targets reference them by `accountId`, and the account row carries the `credentialRef` into the vault.

## Ownership and concurrency (single-writer principle)

| Data              | Writer      | Readers                                                                                          | Change propagation                                                                                                                                                                                    |
| ----------------- | ----------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gateways/*.json` | main only   | main; engine (via message)                                                                       | main writes atomically (tmp + rename), then sends the parsed config to the engine. The engine never watches or reads the files itself, so there is exactly one source of truth and no read/write race |
| `accounts.json`   | main only   | main; engine (via message)                                                                       | same atomic-write + message flow as gateway configs                                                                                                                                                   |
| `settings.json`   | main only   | main                                                                                             | n/a                                                                                                                                                                                                   |
| `vault.bin`       | main only   | main (decrypt)                                                                                   | decrypted secrets handed to the engine in memory at spawn and on change                                                                                                                               |
| `usage.db`        | engine only | main via a read-only connection (serves the Usage drawer over Inter-Process Communication (IPC)) | n/a                                                                                                                                                                                                   |

## Schemas and migrations

- Every JSON document carries `schemaVersion`. Desktop, engine, and the future headless CLI all share zod schemas and pure migration functions, so they become the **first real content of `packages/contracts`**, opening the package that ADR-0010 reserved. Per ADR-0014's recorded follow-up, opening `packages/` adds `packages` to the boundary-scan arguments (`depcruise apps packages`).
- Load path: parse → migrate stepwise to current version → zod-validate. On unreadable or invalid input, the load path sets the file aside as `<name>.corrupt-<timestamp>`, puts a fresh default in its place, and notifies the user. No silent data loss, no silent "best effort" repair.
- `usage.db` schema changes ride SQLite `PRAGMA user_version` with the same stepwise-migration discipline, applied by the engine on open.

## Testability

- Serialization, migration, and validation are pure functions in `packages/contracts`, unit-tested with example specs plus fast-check properties (round-trip: any valid config survives serialize → parse → migrate identity. Migrations are total over their input version).
- Filesystem and SQLite access live in thin shells at the process edges (main's store service, engine's usage recorder), matching the Test-Driven Development (TDD) rule that doubles exist only at real process boundaries.
- One main-process module wraps safeStorage. On Linux, `getSelectedStorageBackend() === 'basic_text'` triggers a visible warning: secrets amount to plaintext there, a platform limitation the warning surfaces rather than hides.

## Out of scope / deferred

- Cloud sync or multi-device state: contradicts offline-first; not planned.
- Log retention/pruning policy: decided once the Usage screen exists (schema leaves room: timestamps + indices).
- Headless CLI secret access: its own ADR when `apps/headless` opens.
- Renderer-side reactive data layer (TanStack Query/DB): belongs to the router/IPC queue items. This spec only fixes what's on disk and who owns it.

## Decision record

Recorded as ADR-0016 via the `architecture-decision-records` skill during implementation (formats per data character, single-writer model, secret lifecycle with detached engine).
