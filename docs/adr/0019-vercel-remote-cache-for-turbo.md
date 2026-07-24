# 0019: Vercel remote cache for Turborepo

**Status**: Accepted
**Date**: 2026-07-23

## Context

Every CI run executed `turbo run lint typecheck build test` from a cold cache: identical inputs were rebuilt and retested on every push, dominating the `check` job's wall-clock. Locally, turbo shares a cache across git worktrees, but developer machines and CI share nothing with each other. Turborepo's remote caching stayed off throughout.

## Decision

Adopt Vercel Remote Cache, free on all Vercel plans, with no requirement to host anything on Vercel:

- `turbo login` plus `turbo link` links the repository to the Vercel scope; the linked team id lives in the `TURBO_TEAMID` repository variable and the access token in the `TURBO_TOKEN` repository secret.
- The `check` job passes both to the turbo step as environment variables. Turbo pulls per-task artifacts on hash match and pushes what it builds, sharing results between developer machines and CI in both directions.
- Degradation is graceful: where the token is absent (forked pull requests, unlinked checkouts), turbo runs with its local cache only, and no gate depends on the remote cache existing.
- This decision defers `TURBO_REMOTE_CACHE_SIGNATURE_KEY` artifact signing: the token is the only writer today. Revisit when a second cache writer (another maintainer, another CI system) appears.

## Alternatives

- **`actions/cache` over `.turbo/cache`**: first-party, zero secrets, adopted for a short stretch earlier on this same branch. Rejected once remote caching won approval: it shares nothing with developer machines, GitHub Actions (GHA) cache isolation scopes restores per branch, and the whole-directory tar is coarser than per-artifact fetch. Remote caching supersedes it, and keeping both would add a redundant save/restore to every run.
- **GitHub-Actions-backed remote-cache emulators** (`rharkor/caching-for-turbo`, `turbo-cache-server`): per-artifact granularity over GHA storage without a Vercel account, but each is a third-party action added to a workflow surface the repo keeps minimal by design, pinned, and audited (zizmor, harden-runner).

## Consequences

- Unchanged tasks replay from the remote cache in CI and locally; a push that was already built on the developer machine can hit the cache on its first CI run. Gates aren't weakened: any input change re-runs the affected tasks in full, because task hashes cover sources, lockfile, and the configs named in `turbo.json` inputs.
- The repository takes its first SaaS dependency for build infrastructure, contained to two environment variables: removing them reverts to local-only caching with no other change. This is a deliberate exception to the self-contained-tooling preference (Architecture Decision Record (ADR) 0015), justified by dev↔CI artifact sharing that no self-contained option provides.
- `TURBO_TOKEN` is a standing secret with cache write access: rotating it on exposure is a one-step dashboard operation, and a leaked token can't touch the repository, only the cache scope.
- Pull-request runs receive the token by design: same-repository pull requests already sit inside the write-trust boundary (a writer could edit the workflow itself), fork pull requests receive no secrets at all, and PR builds are the primary cache consumer in a PR-only workflow. Revisit, moving the token behind a trusted-push boundary, when write access widens beyond a single maintainer.
- Cache reads happen over the network; on cache-miss-heavy runs the overhead is a few seconds of probing, small against the minutes saved on hits.
