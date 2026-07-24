# 0016: Storage, JSON configs, safeStorage vault, node:sqlite usage log

**Status**: Accepted
**Date**: 2026-07-23

## Context

Four kinds of data need local, offline persistence, each with different characteristics. These four are gateway configs (the canvas graph, also the product's shareable artifact), provider secrets, app settings, and the usage log behind the Usage drawer. The engine reads configs and secrets but runs with zero `electron` imports and outlives the app window. A future headless CLI must reuse the same storage.

## Decision

- **Per-character formats** (user-locked): gateway configs as one JSON file per gateway (`userData/gateways/<slug>.json`, human-readable, git-able, the same truth as the canvas "Edit-as-JSON" view); a cross-gateway `accounts.json` registry referenced by `accountId`; app settings as one small JSON (no settings library, because electron-store has gone unmaintained); secrets in a safeStorage-encrypted `vault.bin` keyed by `credentialRef`; usage logs in an engine-owned `node:sqlite` database (zero native deps, same code headless; `better-sqlite3` is the recorded fallback if Electron's Node disagrees).
- **Single-writer per file**: main owns configs/accounts/settings/vault; the engine owns `usage.db`. Config changes reach the engine by message, never by file watching, keeping one source of truth with no read/write races. Main writes atomically (tmp + rename).
- **Secrets flow, never rest, outside the vault**: only main decrypts; decrypted values pass to the engine in memory at spawn and on change; the engine never writes a secret to disk; the detached engine keeps serving after app quit with what it holds and is respawned only by the app. Configs structurally can't carry secrets (strict schemas reject unknown keys). An injected platform parameter guards the Linux-only backend probe, and the codec surfaces basic_text as an explicit plaintext-fallback flag.
- **schemaVersion + stepwise migrations everywhere**, shared through `@recompose/contracts`, opened by this decision as the first real package (`zod` schemas, pure migration chain, fast-check round-trip properties). The storage layer quarantines unreadable or invalid documents aside as `<name>.corrupt-<timestamp>` and reports them. It never repairs or deletes a document without telling the user.
- On Linux, `safeStorage`'s `basic_text` fallback reaches the user as a visible warning, not hidden.

## Alternatives

- **Single SQLite for everything**: transactional and tidy, but turns the shareable config into an opaque blob and adds an export step between the user and their own data.
- **OS keychain library (direct)**: would let headless read secrets without Electron, at the cost of a native dependency and per-process keychain prompts; deferred to the headless decision record.
- **electron-store**: unmaintained; a zod-validated file is smaller and typed end-to-end.

## Consequences

**Good**: configs are portable and diffable. Every document carries a version from day one. The secret boundary is structural: schemas reject unknown keys, the vault file never sees plaintext, and the engine never persists secrets. Contracts opened with pure, property-tested logic shared by all three consumers.

**Bad**: engine-side pieces (usage recorder, config/secret message handoff) wait for `packages/engine`. A detached engine can't be respawned without the app. JSON files are editable by hand outside the app, so quarantine handles breakage, but hand edits between app sessions are a supported risk, not a prevented one.
