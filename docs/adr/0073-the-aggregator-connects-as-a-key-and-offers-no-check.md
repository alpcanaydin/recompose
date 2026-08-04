# 0073: The aggregator connects as a key and offers no check

**Status**: Accepted
**Date**: 2026-08-04

## Context

OpenRouter already connects through the key machinery under the `aggregator` kind. Architecture Decision Record (ADR) 0070 fixed key verification as `GET /v1/models` against the vendor's own host. OpenRouter serves that catalog without authentication: its docs fetch the models list with no header, so a 200 proves the service is up and says nothing about the key. A probe built that way would bless a garbage key, which is worse than no probe. The endpoint that does answer about the key, the credential-scoped key report, returns spend, limit, and tier data. This surface has nowhere to put any of it: the row holds a title, a name, and a mask.

## Decision

**OpenRouter connects exactly as a key.** The two-field form, the vault write, the `aggregator` kind, and the two-line row anatomy all serve unchanged. The row offers no Verify act anywhere on or behind it, and `checkableKey` stays the single gate that decides. The check waits for the surface that can hold what the honest endpoint returns, rather than shipping half of one now.

**A row carries a standing exactly when recompose can observe one without spending.** The family rule appears once, here. Subscription rows observe local evidence, so they carry a chip. Local rows observe a loopback answer, so they carry a chip. Key and aggregator rows would have to spend or half-answer, so they stay quiet, and the key row's Verify act stays an explicit question rather than a standing.

## Consequences

**Good**: no aggregator row can claim what nobody verified, and the quiet row is a rule rather than an oversight. The standing family rule now decides every future row's trailing edge without a meeting.

**Bad**: a dead OpenRouter key surfaces at spend time, not before. The person who wants reassurance today doesn't get it, and the later change that builds a spend surface inherits the check as scope.

## Alternatives

**Adding `openrouter` to the key-probe enum.** Rejected: the models list is public, so the probe would answer `authenticates` for any string. A false green on a credential is the one lie this screen must never tell.

**Probing the credential-scoped key report now.** Rejected: its answer carries limit and usage data with no home on the row, and folding it to a bare verdict discards exactly what the person would act on.

**Widening ADR 0070's verdict triad for one vendor.** Rejected: the triad describes first-party key checks, and a fourth arm for one aggregator couples two families that age differently.
