# 0058: The slug rule tightens to a bounded, device-safe identifier

**Status**: Accepted
**Date**: 2026-07-31

## Context

`gatewaySlugSchema` accepted any length, and it accepted `con`, `nul`, and their siblings. The slug names a file on disk, and Windows reserves those device names under any extension. A gateway called `con` would store nowhere and fail with a filesystem surprise rather than a sentence.

Architecture Decision Record (ADR) 0005 also flagged reserved route names, a concern the port-per-gateway decision dissolved.

## Decision

The slug keeps its lowercase single-dash grammar and gains two rules. It accepts at most 63 characters, and it refuses the Windows device names.

The bound is the Domain Name System (DNS) label bound, which keeps a slug both a safe filename and a safe hostname label everywhere. The rule lives in `packages/contracts`, so the creation sheet and the main process share it by construction rather than by agreement.

The rule reserves no name. Nothing routes by path any longer, so `v1` and `health` are ordinary slugs.

## Alternatives

- **Reserving `v1` and `health` anyway**: no path exists for the collision, and an unused reservation is a rule someone has to remember to delete.
- **Encoding the slug for the filesystem at write time**: escaping hides the constraint instead of stating it.
- **A 255-character bound**: a hostname-safe slug costs nothing today and spares a future migration.

## Consequences

**Good**: a gateway named `con` fails at the creation sheet with a sentence a person can act on. One rule serves both enforcement points.

**Bad**: the bound and the refusal are new constraints a future import feature has to surface. The device-name list is a Windows fact the code carries on every platform.
