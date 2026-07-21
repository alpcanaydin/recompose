# ADR-0005: Single Port, Path per Gateway, Both Dialects Always

**Status**: Accepted
**Date**: 2026-07-21

## Context

Each gateway is a running endpoint that clients (Claude Code, Codex, Cursor…) point at via `ANTHROPIC_BASE_URL`/`OPENAI_BASE_URL`. Early sketches gave every gateway its own port and a per-gateway protocol type — both leaked infrastructure decisions onto the user.

## Decision

One server on a single default port (`:8397`, configurable in Settings). Every gateway is a path on it (`http://localhost:8397/my-gateway`). Every gateway always serves BOTH API dialects on that one base URL; the request path disambiguates (`/v1/messages` = Anthropic, `/v1/chat/completions` = OpenAI). No protocol subpaths, no per-gateway protocol selection.

## Alternatives

- **Port per gateway**: port collisions, firewall prompts per gateway, addresses churn on duplicate/rename.
- **Per-gateway protocol type**: forces users to decide upfront what should be a non-decision; two gateways needed to serve one model set to mixed clients.

## Consequences

**Good**: one address to remember; duplicating a gateway just allocates a new path; sidebar rows stay clean (name + status dot, no port); any client dialect works against any gateway with zero config.

**Bad**: one server process is a single point of failure for all gateways — mitigated by per-gateway start/stop being routing-level, not process-level. Path routing must reserve gateway names that collide with API paths (`v1`, etc.).
