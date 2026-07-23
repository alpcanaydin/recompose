# ADR-0020: jscpd Duplicate-Code Gate at Zero Threshold

**Status**: Accepted
**Date**: 2026-07-23

## Context

No machine checked for copy-paste duplication. The clean-code rules demand one authoritative representation per business rule, and with no human routinely reading the code, a pasted block silently becomes a second source of truth that drifts from the first. The control-gates queue orders this gate first, under the standing rule that every gate runs as a lefthook pre-commit job, a CI step, and a required check.

## Decision

- **jscpd 5.0.12, exact-pinned root devDependency.** Version 5 is the upstream project's Rust rewrite (the TypeScript implementation ended at 4.x); it scans this repository in ~10 ms, cheap enough for pre-commit. The release cleared the workspace's `minimumReleaseAge` quarantine on its own age — no exclusion entry.
- **Scope: production sources only.** `lint:dup` runs `jscpd -c .jscpd.json apps packages`; the config ignores `**/*.gen.ts` (generated route trees) and `**/*.test.ts{,x}`. Test files are excluded deliberately: the codebase's per-file fixture convention duplicates fixtures across sibling spec files on purpose, and behavior specs that read alike encode different behaviors — the DRY-for-knowledge rule says those are not duplication. Measured at adoption: 8 clones, all in test files; production code carried zero.
- **Threshold: 0.** Any detected clone of at least 50 tokens and 5 lines (jscpd defaults, pinned explicitly in `.jscpd.json`) fails the gate. The queue's ratchet philosophy says start just above today's number — today's number is 0.00%, so the floor is also the strictest possible setting and there is nothing to ratchet.
- **`.ts` and `.tsx` are compared as one format.** By default jscpd only compares clones within a format, so a block pasted between a `.ts` module and a `.tsx` component would slip through. `formatsExts` remaps both extensions into the `typescript` format (empirically verified: an identical cross-extension block goes from undetected to detected). The v4 option for this, `crossFormats`, does not exist in v5 — the config parser rejects it as an unknown field.
- **Wiring per the standing rule:** lefthook pre-commit job `dup` beside `dead`; CI step appended to the `check` job's lint chain, so the gate is transitively required through `ci-success` (ADR-0007) without touching the ruleset.

## Alternatives

- **Include test files with a lenient threshold (~4%)** — one gate covering everything, but it would penalize the deliberate fixture convention and force either a permanently loose threshold or constant churn. A loose all-inclusive gate is weaker than a zero-tolerance production gate.
- **Two-tier gate (strict production run + lenient test run)** — defensible later; not built now because the test tier would start life loose and unactionable. Revisit if test duplication visibly rots.
- **jscpd@4.x (TypeScript implementation)** — superseded upstream; slower with no compensating advantage.

## Consequences

- A single new production clone (≥50 tokens, ≥5 lines) fails pre-commit and CI. Deliberate look-alikes that encode different decisions can be restructured below the token floor, or — exceptionally — the config's ignore list amended in the same PR, where the diff makes the exemption reviewable.
- Test-file duplication is invisible to this gate by design; the per-file fixture convention remains the responsibility of spec review.
- Generated files stay ignored by pattern; new generators must extend `.jscpd.json` or fail the gate loudly.
