# 0055: Each gateway owns its own loopback port

**Status**: Accepted
**Date**: 2026-07-31

## Context

Architecture Decision Record (ADR) 0005 put every gateway behind one port and picked the gateway from the first path segment. That shape left per-gateway start and stop at routing level, and it left one status dot mirroring one engine state for every gateway at once. It also forced a reserved-slug list, because a gateway named `v1` would collide with an API path.

The base-URL research found the deeper cost. A client that joins its base URL to a path breaks a path-prefixed base in documented ways. The two dialects also disagree about where `/v1` belongs, so one shared prefix can't serve both habits.

## Decision

Each gateway binds its own loopback port and answers at the root of its address. The stored gateway document carries the port at schema version 1. First-segment routing, path normalization, dialect-by-suffix guessing, and the reserved-slug list all leave with the shared port.

This record supersedes ADR-0005.

## Alternatives

- **One shared port with path routing**: a taken port killed every gateway at once, and the copied address broke under base-URL joining.
- **One process per gateway**: listeners isolate failure well enough, and processes multiply memory for nothing.

## Consequences

**Good**: a taken port fails one gateway alone. The copied address is a bare origin that survives every client's joining rule. No naming rule can invalidate a stored document. The engine never repairs a path or answers a redirect.

**Bad**: every gateway costs one more port, and each start can meet its own squatter. The creation sheet has to offer a free port, and the failed-start recovery becomes load-bearing.
