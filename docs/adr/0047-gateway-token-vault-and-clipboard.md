# 0047: The gateway token lives in the vault and copies through main

**Status**: Accepted
**Date**: 2026-07-29

## Context

The settings screen's Server section carries a switch that requires a token on the local gateway. recompose fronts paid accounts, so a gateway serving a local network without one hands the quota to whoever asks. Turning the switch on needs three answers: where the token lives, how it reaches the person's clipboard, and what the screen shows.

The repository already holds both halves of the storage answer. The settings document sits on disk in plain text, and the vault beside it encrypts secrets through `safeStorage` under a caller-chosen reference, per Architecture Decision Record (ADR) 0016. The account-connect flow in `apps/desktop/src/main/ipc/storage-ipc.ts` shows the sequence: guard on encryption availability, open the vault, write the secret, save the file.

This decision earns a record of its own on three counts. It departs from published bearer-token guidance. It sets the shape every later secret-bearing feature will copy. It accepts an exposure the platform gives no way to close.

## Decision

### A fixed vault reference

`GATEWAY_TOKEN_REF` in `apps/desktop/src/main/settings/gateway-token.ts` holds the constant `gateway-token`, and the token never uses another. Accounts mint a reference per connected row, because many rows exist. One gateway token exists, so a fixed reference makes every guarantee about it checkable by reading one constant.

### Minting in the main process

`mintGatewayToken` reads 32 bytes from the `randomBytes` generator in `node:crypto` and encodes them as unpadded base64url behind an `rc-local-` prefix. That yields 256 bits of entropy in a 52-character value, past the 128-bit size the Open Worldwide Application Security Project (OWASP) session-management guidance recommends. The renderer never mints, so nothing outside main ever holds a fresh token.

`gateway-token:mint` serves both the first enable and a regeneration, because minting a replacement and minting a first token are one act.

### Masking to the prefix and the last four characters

`maskGatewayToken` answers `rc-local-`, eight bullet characters, and the last four characters of the token. `gateway-token:status` and `gateway-token:mint` both reply with the mask alone. Nothing else about the value crosses the bridge, and a type-level spec asserts that the settings type carries no token property at all.

### Copy through the main-process clipboard

`gateway-token:copy` reads the secret in main and hands it to an injected `writeClipboard` port, which `apps/desktop/src/main/index.ts` binds to Electron's `clipboard` module. The plaintext never enters the renderer, so no rendered node, screenshot, or screen share can hold it. The route also never meets the deny-by-default permission handler that ADR-0028 placed between the renderer and every web permission, `clipboard-sanitized-write` included. Widening that allowlist for one string would have cost more than the channel did.

Copying a token the vault doesn't hold returns a typed `token-missing` rather than an empty clipboard write, and the row offers Generate in place of Copy.

### Copy without reveal

The screen offers no reveal action. That was a decision rather than an omission. A revealed token survives in screenshots, in screen recordings, and in whatever the person was sharing at the time, and the value has one job that copying serves in full. Identity guidance recommends that a verifier offer to display a secret while a person types it, and that guidance covers secrets people type. Nobody types this one.

### Turning the requirement off keeps the token

Setting `requireGatewayToken` to false writes that field and nothing else. `deleteSecret` appears once in `storage-ipc.ts`, on the account-removal path, and never against `GATEWAY_TOKEN_REF`. The spec's guarantee that a stored token survives the switch therefore holds by structure rather than by discipline. No code path exists that could break it, so no reviewer has to remember not to write one.

### The deviations this record states rather than hides

The bearer-token specification, Request for Comments (RFC) 6750, fixes the wire format and mandates transport security. A listener bound to the loopback interface can't offer transport security, and the deviation is defensible there, because the traffic never leaves the machine. The same specification declines to specify token contents, which is why the entropy floor above cites OWASP instead.

Copying to the clipboard exposes the value to Windows clipboard history, which Electron gives no way to suppress. This design accepts that rather than wiping the clipboard on a timer. A timed wipe breaks the paste of a person who copied on purpose, and it reports nothing when it does.

## Alternatives

- **Storing the token in the settings document.** Rejected because that document sits on disk in plain text, and the spec forbids a token in it.
- **`navigator.clipboard.writeText` in the renderer.** Rejected on two counts. It needs the plaintext in the renderer, which defeats the mask. It also meets a permission handler that denies every request, so it would force an allowlist entry for a job a channel already does.
- **A reveal action beside copy.** Rejected because a revealed token outlives the moment on any surface that captures the screen, and copy already carries the value where it needs to go.
- **Deleting the token when the requirement turns off.** Rejected because the spec requires the stored token to survive, so a person who turns the switch back on meets the same token rather than a new one.
- **A minted reference per token, matching accounts.** Rejected because one token needs one reference, and a fixed constant is what makes the survival guarantee readable in a single grep.
- **Clearing the clipboard on a timer after a copy.** Rejected as stated above.

## Consequences

- Every later secret-bearing feature inherits this shape: mint in main, mask on the way out, and act on the plaintext in main. The pattern is now the precedent rather than an improvisation.
- `StorageIpcContext` grows a `writeClipboard` port, so the token specs assert against a collected array and never touch the real clipboard.
- The vault gains one entry under a new reference. An older build reads the vault file, finds a reference it doesn't recognize, and leaves it alone, because the vault holds a flat map with no schema over its keys.
- Where the operating system offers no keyring, `safeStorage` falls back to plain text. `gateway-token:status` reports `plaintext-fallback`, and the token row shows the warning ADR-0016 requires stay visible.
- Where encryption is missing outright, the status answers a null mask and an `unavailable` store, and no mint runs.
- A person who loses a copied token regenerates rather than recovering it. The vault holds the only copy and nothing displays it, which is the cost of the no-reveal decision.
- The Windows clipboard-history exposure stays open. This record documents it so the next reader meets a known trade rather than an oversight.
