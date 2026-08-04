# 0072: A local runtime account is a credential-free observation

**Status**: Accepted
**Date**: 2026-08-04

## Context

The Local Runtimes destination routes to a placeholder, and the accounts document refuses to store a local row. Architecture Decision Record (ADR) 0069 splits the account row by kind and gives only the credentialed kinds a `credentialRef`, enforced as a parse error. A local runtime inverts the credential story: Ollama serves loopback with no key and ignores any it receives, so there's nothing to store and nothing to check. The reading a person needs is reachability. The defect record binds the address: Node resolves `localhost` to IPv6 while Ollama listens on IPv4, producing connection refusals that a literal `127.0.0.1` never produces. ADR 0070 put provider probes in the engine child behind the `desktop-not-into-engine` wall.

## Decision

**A local account is its own union arm.** The arm holds `{ id, provider, kind: 'local', address }`, parsed as a `strictObject` with no `label` and no `credentialRef`. A credential on a local row is a parse error, the mechanism ADR 0069 set. `ACCOUNTS_VERSION` moves from 3 to 4 with a restamp-only migration, so an older build refuses the newer document readably instead of quarantining it.

**Main mints the stored address, and the person's one knob is the port.** The address comes from a contracts-owned table, and main swaps the person's port into it, so the renderer never supplies a host. The port defaults to the documented `11434`, and the detect step lets a person point the look at another, because the runtime's own host variable commonly moves it. The renderer sends the port alone, and main mints the whole address. A loopback-only schema guards it at every parse, in the document and on the probe directive alike, so no row can ever hold `localhost` or a foreign host.

**Reachability is a probe the engine child runs.** A `probe-runtime` directive stands beside the key probe: `GET /api/version`, redirects refused, a three-second bound. The bound lives in the contracts module beside the address table, because the host's wait bound must stand above it and only contracts crosses that wall. The child mints three verdicts disjoint from the key-check triad: `answers` with the version, `unrecognized` with the status, and `unreachable`. Main folds a dead child to `unreachable`. The verdicts stay their own union: a reachability reading describes whether a machine answered, never what a vendor said about a credential. And `unrecognized` exists precisely because a port can answer without being Ollama.

**Detection runs before adding, and nothing stores until the person decides.** A stored row re-observes its standing on every mount, and no verdict is ever stored. The connect channel takes the runtime id and the port alone, so a local account with a secret is impossible by construction, and the local path never opens the vault.

## Consequences

**Good**: the forbidden states have no shape, so no test, review, or migration has to police a credential on a local row. The registry stores only what a person decided, and a squatting stranger never reads as Ollama.

**Bad**: a row costs one loopback fetch per mount, and a standing can lag the truth by one observation. A runtime moved off the loopback host entirely still can't connect, and the design says so rather than offering a host field. A dead engine child reads as Not running rather than as an error a person can act on, with the honest detail in main's log.

## Alternatives

**A token-optional credentialed arm.** Rejected: it makes the required field optional and dissolves ADR 0069's parse-error gate into a review note.

**An editable base URL.** Rejected: the recorded defect classes are exactly `localhost` resolution and path normalization. The port field survives that test, because the host and the path never leave recompose's hands.

**Storing the standing beside the row.** Rejected: a local server stops between two renders far more often than a vendor revokes a key, so the stored claim would lie faster than ADR 0070's case.

**A port sweep to find runtimes.** Rejected: it's a firewall-prompt generator and sits badly beside an offline-first posture.
