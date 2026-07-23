# Storage Architecture — Design

Date: 2026-07-23
Status: Approved

## Context

Fourth infrastructure-queue item. recompose is local and offline-first: no cloud, no signup. Four kinds of data need persistence, each with a different character: gateway configs (the canvas graph the whole product revolves around), provider secrets (API keys, subscription tokens), app settings, and request/usage logs (feeding the Usage drawer's 24h spend chart, tok/min chip, and per-provider bars). Two consumers beyond the renderer bind the design: the gateway engine runs in a `utilityProcess` with zero `electron` imports and **outlives the app window** (locked 2026-07-21), and a future headless CLI must reuse the same storage without Electron.

## Decisions (user-locked)

- **Gateway configs are JSON files** — one file per gateway under `userData/gateways/<slug>.json`, zod-validated, containing virtual models, router chains, targets, provider-account references, and a canvas-layout section. The file is the same truth the canvas toolbar's "Edit-as-JSON" button shows; it is human-readable, exportable, and git-able. Secrets never appear in it — accounts point into the vault via `credentialRef`.
- **Secrets live in a safeStorage vault with in-memory handoff.** `userData/vault.bin` holds a map of `credentialRef → safeStorage-encrypted value` (macOS Keychain / Windows DPAPI / Linux libsecret as the key source). Only the Electron main process decrypts; decrypted secrets travel to the engine **by message** at spawn and on change. The engine keeps them in memory and never writes a secret to disk. When the app quits, the detached engine continues with what it holds; it cannot be respawned without the app (its supervisor is the app — accepted). Headless CLI secret access is deferred to its own ADR.
- **Usage logs are `node:sqlite`** — `userData/usage.db`, owned and written exclusively by the engine. Node's built-in SQLite means zero native dependencies, no per-Electron rebuild, and identical code in the future headless CLI. Fallback recorded up front: if the Electron 43 Node runtime's `node:sqlite` proves unstable at implementation time, `better-sqlite3` is the substitute (mature, but native-rebuild-coupled).
- **App settings are one small JSON** — `userData/settings.json` (theme, window, engine port). No settings library: electron-store is unmaintained; a zod-validated file read/write is sufficient.

## File layout

```text
<userData>/
├─ gateways/<slug>.json   single gateway config + canvas layout, schemaVersion'd
├─ accounts.json          provider-account registry (label, provider, kind, credentialRef), schemaVersion'd
├─ settings.json          app preferences, schemaVersion'd
├─ vault.bin              safeStorage-encrypted secret map
└─ usage.db               node:sqlite, engine-owned request/usage log
```

Accounts are cross-gateway entities (one subscription serves many gateways), so they live in their own registry; gateway targets reference them by `accountId`, and the account row carries the `credentialRef` into the vault.

## Ownership and concurrency (single-writer principle)

| Data              | Writer      | Readers                                                            | Change propagation                                                                                                                                                                                     |
| ----------------- | ----------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `gateways/*.json` | main only   | main; engine (via message)                                         | main writes atomically (tmp + rename), then sends the parsed config to the engine — the engine never watches or reads the files itself, so there is exactly one source of truth and no read/write race |
| `accounts.json`   | main only   | main; engine (via message)                                         | same atomic-write + message flow as gateway configs                                                                                                                                                    |
| `settings.json`   | main only   | main                                                               | n/a                                                                                                                                                                                                    |
| `vault.bin`       | main only   | main (decrypt)                                                     | decrypted secrets handed to the engine in memory at spawn and on change                                                                                                                                |
| `usage.db`        | engine only | main via a read-only connection (serves the Usage drawer over IPC) | n/a                                                                                                                                                                                                    |

## Schemas and migrations

- Every JSON document carries `schemaVersion`. zod schemas and pure migration functions are shared by desktop, engine, and the future headless CLI — they become the **first real content of `packages/contracts`**, opening the package that ADR-0010 reserved. Per ADR-0014's recorded follow-up, opening `packages/` adds `packages` to the boundary-scan arguments (`depcruise apps packages`).
- Load path: parse → migrate stepwise to current version → zod-validate. On unreadable or invalid input: the file is set aside as `<name>.corrupt-<timestamp>`, a fresh default takes its place, and the user is notified. No silent data loss, no silent "best effort" repair.
- `usage.db` schema changes ride SQLite `PRAGMA user_version` with the same stepwise-migration discipline, applied by the engine on open.

## Testability

- Serialization, migration, and validation are pure functions in `packages/contracts` — unit-tested with example specs plus fast-check properties (round-trip: any valid config survives serialize → parse → migrate identity; migrations are total over their input version).
- Filesystem and SQLite access live in thin shells at the process edges (main's store service, engine's usage recorder), matching the TDD rule that doubles exist only at real process boundaries.
- safeStorage is wrapped in one main-process module; on Linux, `getSelectedStorageBackend() === 'basic_text'` triggers a visible warning (secrets effectively plaintext — platform limitation, surfaced not hidden).

## Out of scope / deferred

- Cloud sync or multi-device state: contradicts offline-first; not planned.
- Log retention/pruning policy: decided when the Usage screen is implemented (schema leaves room: timestamps + indices).
- Headless CLI secret access: its own ADR when `apps/headless` opens.
- Renderer-side reactive data layer (TanStack Query/DB): belongs to the router/IPC queue items; this spec only fixes what is on disk and who owns it.

## Decision record

Recorded as ADR-0016 via the `architecture-decision-records` skill during implementation (formats per data character, single-writer model, secret lifecycle with detached engine).
