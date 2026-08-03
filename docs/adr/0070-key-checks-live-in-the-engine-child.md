# 0070: Key checks live in the engine child

**Status**: Accepted
**Date**: 2026-08-03

## Context

The `desktop-not-into-engine` rule in `.dependency-cruiser.cjs` walls main off from `packages/engine` at error severity, and the engine already knows both vendors' path families in `gateway-app.ts`. A stored key needs a way to answer "does this still work" without recompose spending it. The defect record binds the transport. Rider #118 is a credential blob riding argv, the recorded 401 bodies can carry key material, and prefix gates rejected legitimate keys in openclaw#72121.

## Decision

**Verification is a probe the engine child runs.** The probe is a pure fetch-injected module under `packages/engine/src/provider/`, reached through a new `probe` directive on the existing parent-port protocol. It sends `GET /v1/models` with the vendor's own header, refuses redirects, and bounds the call. Main folds every failure to obtain a vendor status into the could-not-check verdict. The host's probe wait bound stands above the child's fetch bound, so the child's honest answer wins the race against the host giving up.

**Main decrypts, and one message carries the key.** Main reads the row, opens the vault, and decrypts inside the vault queue. It then hands the key to the child in one structured-clone directive message: never argv, never an environment variable, never disk. The child holds the key in the probe call's function scope for the fetch's lifetime. Its report carries a verdict and an optional status code, with no field a body could occupy.

**The mask mints at connect time.** Main computes the tail, the last four characters of the trimmed key with no vendor prefix, inside the connect, and stores it on the row as a non-secret field. Listing accounts never opens the vault, and only the explicit check act decrypts a secret.

**A verdict is never stored.** The check's answer lives in the renderer mutation that asked, the copy speaks as of the check's moment, and a remount forgets it. Revocation propagates over minutes at the vendors, so a stored verdict becomes a lie with no event to correct it.

## Consequences

**Good**: dialect knowledge keeps one home, the key crosses one boundary in one message, and the report schema has no room to smuggle an upstream byte. Listing stays free of vault reads, because the tail rides the row.

**Bad**: a probe on a machine running no gateway spawns the resident child. The check path now depends on the child's health, so a dead child reads as could-not-check rather than as an error the person can act on. The parent-port protocol carries a secret for the first time, which makes the child's log pipes a hygiene surface. The sanitized refusal rule follows: the child logs issue paths and codes, never received values.

## Alternatives

**Fetch from main.** Rejected: it either duplicates vendor dialect knowledge across the wall or tears the wall down, and the wall is the architecture.

**Verify in the renderer.** Impossible: the sandbox has no vendor reach, and a key must never cross the bridge.

**A separate verification child.** Rejected: a second process for one bounded call, when the resident child already speaks a directive protocol.

**Pass the key through argv or the environment.** Rejected: argv is the exact defect class rider #118 records. An environment variable lingers on the process object for every library to read.

**Store a last-check column beside its timestamp.** Rejected: the row would assert freshness the vendor can revoke at any moment, and no event arrives to correct it.
