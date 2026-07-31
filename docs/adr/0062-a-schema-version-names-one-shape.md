# 0062: A schema version names one shape, and every store reads it first

**Status**: Accepted
**Date**: 2026-07-31

## Context

Two reviewers read this branch's storage code and found the same class of defect three times.

Architecture Decision Record (ADR) 0054 taught the settings store to read the version before parsing. A document from a newer build now raises a typed failure rather than going to quarantine. That record closed with a warning: any future store reading a versioned document has to call `newerSchemaVersion` to inherit the behavior, and nothing enforced it.

The gateway store is that store. It handed every document straight to `readDocumentWithQuarantine`, so a gateway written by a newer build failed the schema, got renamed to `.corrupt-<timestamp>`, and left the sidebar, the tray, and the list. The only trace was a `console.warn` nobody reads.

Two version numbers also drifted from the shapes they name.

`GATEWAY_CONFIG_VERSION` stayed at 1 while commit `3bfc056` made `port` required and dropped the lower bound on `virtualModels`, both inside a `z.strictObject`. That commit reasoned the stored gateways directory was empty.

`SETTINGS_VERSION` reached 3 in commit `a0dfc5d` carrying `requireGatewayToken`. Commit `413318c` removed the field and left the version at 3. A document written between those two commits fails the current strict parse on `unrecognized_keys`, `migrateDocument` does nothing because the version already matches, and the file goes to quarantine. Every setting resets.

## Decision

**The gateway store reads the version before parsing.** `loadOneGatewayConfig` calls `newerSchemaVersion` and throws `GatewayNewerSchemaError`, carrying the version the document names. Every caller of `listGatewayConfigs` already wraps its read, so the failure reaches the screen and the file stays where it is.

**The settings document moves to version 4.** A migration from 3 drops `requireGatewayToken`, so a document written mid-branch reads rather than resetting. Each migration now owns one change: the step from 2 retires the app-wide port, the step from 3 retires the token requirement. The step from 2 used to drop both, which hid that version 3 ever held the field.

**`GATEWAY_CONFIG_VERSION` stays at 1.** Three facts decide it:

- The old shape shipped in v0.2.0, and in that tag the only reference to the `gateways:save` channel outside the main process is the renderer's fake bridge for tests. No screen reaches the channel.
- The screen that creates a gateway landed in commit `de96984`, after `3bfc056` changed the shape.
- Together those mean no build, released or intermediate, could write a version 1 document in the old shape. The population is zero, so no reader will ever meet an ambiguous version 1 document.

A bump would also fail to buy the thing it looks like it buys. v0.2.0 ships as it stands and predates ADR-0054, so it quarantines a version 2 document exactly as it quarantines the new version 1 shape. A downgrade costs the same either way. A migration from 1 would also have to invent a port. The port it would restore lived in the settings document as `enginePort`, and a migration reads only its own document. Two gateways would land on the same invented port.

## Alternatives

- **Bump the gateway version to 2 anyway, as cheap insurance**: buys an honest number for a population of zero, and pays for it with a migration that can never run against a real document and that has to invent a port. Untestable code with invented semantics is what the mutation gate exists to catch.
- **Skip only the newer gateway and keep listing the rest**: kinder than failing the whole list, but `listGatewayConfigs` would need a second callback, which changes a signature six call sites share. Deferred rather than rejected.
- **Loosen the settings schema to tolerate an unknown key**: would read the mid-branch document, and would also stop `z.strictObject` from catching the next typo. The guard is worth more than the one document it costs.
- **Leave the settings version at 3 and accept the reset**: the affected profile belongs to whoever ran a mid-branch build, which includes the machine that carries this branch. A reset that a five-line migration prevents isn't a reset worth taking.

## Consequences

**Good**: a gateway from a newer build survives a downgrade and says why this build can't read it, matching the settings store and the vault. A settings document written mid-branch keeps every choice. The migration chain now reads as the history it describes, one retirement per step.

**Bad**: one unreadable gateway fails the whole list rather than hiding a single row, so a person sees no gateways until they move back to the newer build. Nothing leaves the disk and the move back restores everything, which is the trade this record accepts.

The gateway failure travels as `storage-failed` rather than a code of its own, because `ipcErrorSchema` sits outside the files this change owns. A `gateway-newer-schema` code beside `settings-newer-schema` and `vault-newer-schema` is the follow-up. The accounts store still reads without the guard, and carries the same latent defect.

Version 1 of the gateway document remains a number git history shows against two shapes. A future migration author who reads the history rather than the shipped schema could write a step for a document that never existed. This record keeps the three facts above, so that author can check them instead of deriving them again.
