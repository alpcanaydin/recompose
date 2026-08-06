# 0078: An absent model is 404, and broken backing is 502

**Status**: Accepted
**Date**: 2026-08-06

## Context

A virtual model fails to serve four ways. The name was never defined, the target account left the registry, the vault holds no credential for a credentialed target, or the upstream never answers. The shipped serving path answered every model request 404. That was honest while no virtual model existed, and it turns into a lie the moment one lists in `GET /v1/models`. Both vendor SDKs retry every status of 500 and above, so the status choice decides whether a permanent misconfiguration earns a retry storm.

## Decision

An unknown name answers 404, because the model doesn't exist and never lists. A missing target, a missing credential, and an unreachable target each answer 502. A listed model with broken backing is a bad-gateway condition rather than an absent resource. Each refusal renders in the arriving dialect's own envelope and names the gateway and the virtual model. The gateway never falls back to another target, and a real upstream error body forwards byte for byte with its status.

The pairing holds across layers. The stored config parses a binding onto a departed account on purpose, so the serving path can refuse it with a 502 that names what left. Refusing at parse would make the whole document unreadable and the row invisible, which hides the fault instead of naming it.

A defined model's `count_tokens` path answers 400 rather than 404 or 501. The model exists, no slice target can serve a count, and the 5xx class would invite retries a permanently unsupported operation never satisfies.

## Alternatives

- **Uniform 404 for every refusal**: rejected because it mislabels a listed model as absent, contradicting the gateway's own listing.
- **503 for the config faults**: rejected because 503 reads as transient. A removed target and a missing credential are permanent until the operator acts, so a retry-later promise would lie.
- **Refusing a departed-account binding at parse**: rejected because parse-time refusal quarantines the document and hides the row a person needs to see to fix the fault.

## Consequences

**Good**: the status matches what a caller can do next. A 404 means fix the name, a 502 means fix the gateway's backing, and neither invites a retry storm. The listing, the drawer standing, and the wire refusal all tell one story about the same fault.

**Bad**: 502 overloads one status with three causes, and the typed body carries the split (`missing_target`, `missing_credential`, `target_unreachable`). The unreachable-target case is sometimes transient, and the SDKs retry a 502 anyway, which softens the cost. Two refusal bodies (`count_tokens`, unreachable target) render outside the `TranslationRefusal` vocabulary today, and the ledger tracks folding them in.

## Mutation-testing exceptions

Two accepted survivors ride this change's contracts suite. One is an equivalent mutant that feeds a string into `readonly Account[]`, which the relaxed Stryker tsconfig admits and no behavior test can kill. The other is a pre-existing `layoutSchema.viewport` mutant outside the changed lines. Both stand recorded here rather than silenced with a threshold change.
