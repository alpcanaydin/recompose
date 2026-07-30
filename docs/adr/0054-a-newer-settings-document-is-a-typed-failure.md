# 0054: A newer settings document is a typed failure, not damage

**Status**: Accepted
**Date**: 2026-07-30

## Context

The vault and the settings store disagreed about what a future schema version means, and issue #92 recorded the gap.

The vault reads the version before parsing. A number beyond what the build supports raises `VaultNewerSchemaError`, and the bridge answers `vault-newer-schema`, so the screen can say the file came from a newer build.

The settings store took the other path. It handed the raw document straight to `loadSettings`, whose `migrateDocument` does throw on a newer version, but it threw into a `catch` that treats every failure as damage. The file went to quarantine and the app carried on with defaults.

Someone who ran a newer build and came back to an older one therefore lost every setting, and read that their file was corrupt when it wasn't. The settings-screen change sharpened this by shipping the first real migration and moving `SETTINGS_VERSION` to 2. Before it, every document was version 1 and the case couldn't arise.

A save made it worse than a read. The whole-document save has since become a patch, but the merge still reads the stored document first. A save after a quarantine would therefore write this build's shape over ground the newer build owned.

## Decision

The settings path reads the version before parsing, exactly as the vault does.

- `newerSchemaVersion(value, supported)` moves into `json-file.ts`, and both stores call it. The rule that a document from a newer build isn't damaged now has one home.
- `loadSettingsFile` throws `SettingsNewerSchemaError`, carrying the version the document names.
- `ipcErrorSchema` gains `settings-newer-schema`, beside `vault-newer-schema`. The type-level spec pins the widened set.
- Both `settings:get` and `settings:save` map it. A save refuses rather than writing over a document it can't read.
- The boot read propagates instead of swallowing. `index.ts` already catches everything and boots with defaults in memory, so the window opens and nothing touches the file.

## Alternatives

- **Let `migrateDocument`'s throw carry a marker the caller can test**: keeps version detection inside a parse step that runs after the document has already failed every schema, and leaves the settings path shaped differently from the vault.
- **Quarantine but keep a copy**: still tells someone their file took damage, and leaves them to find the copy.
- **Refuse to boot**: a settings document nobody can read isn't a reason to withhold the app. The window opens, and the settings screen is where the explanation belongs.

## Consequences

**Good**: a downgrade costs nothing. The document stays put, the screen names the version, and going back to the newer build finds every setting where it was. The two stores now answer a newer document the same way.

**Bad**: the app runs on defaults while the document sits unread, so the theme and the tray follow the defaults rather than the person's choices until they move back. The screen says why, which is the trade this record accepts. Any future store that reads a versioned document has to call `newerSchemaVersion` to inherit the behavior, and nothing enforces that yet.
