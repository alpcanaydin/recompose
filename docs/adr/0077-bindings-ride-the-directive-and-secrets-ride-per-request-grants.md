# 0077: Bindings ride the directive, and secrets ride per-request grants

**Status**: Accepted
**Date**: 2026-08-06

## Context

The first composition slice makes a gateway proxy live traffic to a stored target, which is the first time a stored credential spends. The engine child serves the traffic, but its pipes stream to the parent console, and a secret parked in child memory would sit there for the listener's lifetime. The child still needs to answer `GET /v1/models` listings and unknown-name refusals without waking the parent on every request.

## Decision

Two channels carry a gateway to the child, split by sensitivity. The start directive carries the bindings as a snapshot: each virtual model's id, display name, and target standing (`bound` with the real model name, or `removed`), never a secret. The child answers listings and snapshot-visible refusals from it alone.

A secret rides a per-request spend grant instead. The child asks over a correlated child-to-parent lane, and the parent resolves the target against the live registry and vault. The grant lives in the request handler's function scope until the upstream headers leave. A local target resolves with `custody: 'open'` and no credential, because a local account stores none. Removal and key replacement take effect on the next request with no restart, because the parent resolves live state every time.

## Alternatives

- **Whole credentials on the start directive**: rejected on custody duration. A serving table of live keys parks in child memory while the child's pipes stream to the parent console.
- **Every request resolves names through the parent, with no snapshot**: rejected because a listing and an unknown-name refusal need no parent round trip, and the hot path shouldn't pay one for them.
- **An optional credential field on one resolved grant arm**: rejected under `exactOptionalPropertyTypes` discipline. The open state is a shape (`custody: 'open'`), not an absent key, so a consumer can't mistake an absent credential for an undefined one.

## Consequences

**Good**: a secret's residence in the child is one request handler's scope. The spawn site carries nothing on argv, env, or disk. Registry and vault edits apply on the next request without a restart. The snapshot lets the child refuse an unknown name and list its models with zero parent traffic.

**Bad**: every proxied request pays a parent round trip for its grant. The lane reuses the shipped probe correlation, and the parent is in-process, so the cost is one message pass each way. The grant wait itself carries no give-up bound today, and the ledger tracks that as a deferred hardening.
