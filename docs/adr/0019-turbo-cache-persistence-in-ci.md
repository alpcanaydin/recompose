# ADR-0019: Turbo Cache Persistence in CI via actions/cache

**Status**: Accepted
**Date**: 2026-07-23

## Context

Every CI run executed `turbo run lint typecheck build test` from a cold cache: identical inputs were rebuilt and retested on every push, dominating the `check` job's wall-clock. Locally, turbo already shares a cache across git worktrees; CI had no equivalent persistence. Turborepo's remote caching was disabled throughout.

## Decision

Persist turbo's local cache directory across CI runs with GitHub's first-party `actions/cache`:

- The `check` job caches `.turbo/cache`, keyed `turbo-${{ runner.os }}-${{ github.sha }}` with a `turbo-${{ runner.os }}-` restore-key prefix, so every run restores the nearest prior cache and saves its own.
- The turbo step pins `TURBO_CACHE_DIR: .turbo/cache` so the cached path is explicit rather than dependent on turbo's default resolution.
- Remote caching stays disabled. This is cache persistence for CI runs, not a remote cache: nothing is shared between developer machines and CI.

## Alternatives

- **Vercel Remote Cache** — the zero-config official option and the only one that shares artifacts between developers and CI. Rejected for now: it adds a SaaS dependency and a `TURBO_TOKEN` secret to a repo that has consistently chosen self-contained tooling (ADR-0015). Revisit if a second developer or a second CI consumer appears; migration is additive (two env vars) and this cache step simply becomes redundant.
- **GitHub-Actions-backed remote-cache emulators** (`rharkor/caching-for-turbo`, `turbo-cache-server`) — per-artifact granularity over the same GHA cache storage, but each is a third-party action added to a workflow surface the repo deliberately keeps minimal, pinned, and audited (zizmor, harden-runner). Not worth the supply-chain surface at this repo size.

## Consequences

- Unchanged tasks replay from cache in CI; a typical docs-adjacent or single-package push no longer rebuilds and retests the world. Gates are not weakened: any input change re-runs the affected tasks in full, because task hashes cover sources, lockfile, and the configs named in `turbo.json` inputs.
- GHA cache isolation scopes writes per branch; a pull request can only read caches from its own branch or the base branch, so a PR cannot poison `main`'s cache.
- Restore-key prefix matching means later runs restore the most recent cache and re-save a superset; GitHub evicts least-recently-used entries past the 10 GB repo quota, which bounds growth without maintenance.
- The whole-directory tar is coarser than a true remote cache's per-artifact fetch, and cache save/restore adds a few seconds of overhead to every run — acceptable against the minutes saved on replayed tasks.
