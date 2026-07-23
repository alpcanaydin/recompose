# ADR-0016: Storage — JSON Configs, safeStorage Vault, node:sqlite Usage Log

**Status**: Accepted
**Date**: 2026-07-23

## Context

Four kinds of data need local, offline persistence with different characters: gateway configs (the canvas graph, also the product's shareable artifact), provider secrets, app settings, and the usage log behind the Usage drawer. The engine reads configs and secrets but runs with zero `electron` imports and outlives the app window; a future headless CLI must reuse the same storage.

## Decision

- **Per-character formats** (user-locked): gateway configs as one JSON file per gateway (`userData/gateways/<slug>.json`, human-readable, git-able, the same truth as the canvas "Edit-as-JSON" view); a cross-gateway `accounts.json` registry referenced by `accountId`; app settings as one small JSON (no settings library — electron-store is unmaintained); secrets in a safeStorage-encrypted `vault.bin` keyed by `credentialRef`; usage logs in an engine-owned `node:sqlite` database (zero native deps, same code headless; `better-sqlite3` is the recorded fallback if Electron's Node disagrees).
- **Single-writer per file**: main owns configs/accounts/settings/vault; the engine owns `usage.db`. Config changes reach the engine by message, never by file watching — one source of truth, no read/write races. Main writes atomically (tmp + rename).
- **Secrets flow, never rest, outside the vault**: only main decrypts; decrypted values pass to the engine in memory at spawn and on change; the engine never writes a secret to disk; the detached engine keeps serving after app quit with what it holds and is respawned only by the app. Configs structurally cannot carry secrets (strict schemas reject unknown keys). The Linux-only backend probe is guarded behind an injected platform parameter, and the codec surfaces basic_text as an explicit plaintext-fallback flag.
- **schemaVersion + stepwise migrations everywhere**, shared through `@recompose/contracts` — opened by this decision as the first real package (`zod` schemas, pure migration chain, fast-check round-trip properties). Unreadable or invalid documents are quarantined aside as `<name>.corrupt-<timestamp>` and reported — never silently repaired or deleted.
- On Linux, `safeStorage`'s `basic_text` fallback is surfaced to the user as a visible warning, not hidden.

## Alternatives

- **Single SQLite for everything**: transactional and tidy, but turns the shareable config into an opaque blob and adds an export step between the user and their own data.
- **OS keychain library (direct)**: would let headless read secrets without Electron, at the cost of a native dependency and per-process keychain prompts; deferred to the headless ADR.
- **electron-store**: unmaintained; a zod-validated file is smaller and typed end-to-end.

## Consequences

**Good**: configs are portable and diffable; every document is versioned from day one; the secret boundary is structural (schemas reject unknown keys, vault file never sees plaintext, engine never persists secrets); contracts opened with pure, property-tested logic shared by all three consumers.

**Bad**: engine-side pieces (usage recorder, config/secret message handoff) wait for `packages/engine`; a detached engine cannot be respawned without the app; JSON files are editable by hand outside the app — quarantine handles breakage, but hand edits between app sessions are a supported risk, not a prevented one.
