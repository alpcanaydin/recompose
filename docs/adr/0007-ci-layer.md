# 0007: CI layer

**Status**: Accepted
**Date**: 2026-07-22

## Context

Phase 2 of the quality-gate work, deferred in Architecture Decision Record (ADR) 0006 until the GitHub remote existed, is now unblocked (`alpcanaydin/recompose`, single maintainer). Design spec: `docs/superpowers/specs/2026-07-22-ci-layer-design.md`.

## Decision

Add a CI layer on top of the local gates: one workflow, branch protection as code, hosted dependency updates.

- **Single `ci.yml` with a `ci-success` aggregate job**: `changes` (dorny/paths-filter) / `check` / `gitleaks` / `audit` / `zizmor` / `actionlint` / `commitlint-pr`, all `needs`-ed by `ci-success` with `if: always()`, which fails on any `failure`/`cancelled` result and treats `skipped` as success. Branch protection requires only `ci-success`, so adding, removing, or renaming a job never touches the ruleset.
- **Ruleset JSON + `gh api` over Terraform or the manual UI**: `.github/rulesets/main.json` applied idempotently by `scripts/apply-ruleset.sh` (update-if-found-by-name, create otherwise). Versioned and re-appliable without a state file or an extra toolchain; Terraform would add a backend and provider for a single ruleset, and the UI leaves no diff-able record.
- **Hosted Renovate GitHub App over self-hosted Renovate or Dependabot**: only `renovate.json` lives in the repo, so there is no bot token or runner to maintain. This decision rejects Dependabot in favor of Renovate's finer automerge granularity (devDependency minor/patch only), weekly `lockFileMaintenance` for the pnpm lockfile, and the `config:best-practices` presets, which include action-digest pinning.
- **All third-party actions SHA-pinned**, `permissions: contents: read` at workflow level; individual jobs may escalate permissions if one ever needs it, though none does today.

## Alternatives

- **Per-concern required-checks list** (list every job name in branch protection instead of one aggregate): rejected because the required-check list needs hand-maintenance in lockstep with the workflow, and a renamed job stops enforcement without anyone noticing.
- **Merge queue**: rejected, since a single maintainer and low PR volume mean nothing queues.
- **Dependabot**: rejected, because it offers coarser automerge rules, no built-in lockfile-maintenance schedule, and no equivalent to the `config:best-practices` preset bundle Renovate ships with.
- **Terraform for branch protection**: rejected, since a state backend and provider for one ruleset is disproportionate; a checked-in JSON file applied via `gh api` gives the same versioning without the toolchain.

## Consequences

**Good**: one required check needs satisfying, forever, since the ruleset never needs editing as the workflow grows. `paths-filter` keeps docs-only PRs cheap by skipping `check`/`audit`. `minimumReleaseAge` gives every dependency bump a week-long window during which a bad release can surface before it lands.

**Bad**: the repository-admin bypass actor weakens branch protection for the owner account. A direct push to `main` by that account is still possible in an emergency, which is also its risk. `pnpm audit` has no local pre-commit counterpart, so a newly disclosed advisory only surfaces once CI runs, not at commit time. The hosted Renovate app has read access to repository metadata, which is the standard trust boundary for using a hosted bot instead of self-hosting.
