# ADR-0013: CodeRabbit Review as Required Status Check

**Status**: Accepted
**Date**: 2026-07-23

## Context

CodeRabbit reviews every PR and posts a `CodeRabbit` commit status (pending while the review is queued, success when it lands), but the `main` ruleset (ADR-0007) required only `ci-success`. A PR could therefore merge before its review arrived — the review findings would land on an already-merged PR, where triaging and fixing them means a follow-up branch instead of a pre-merge push. This happened in practice: PR #26 merged while findings were still being addressed.

## Decision

Add `CodeRabbit` (integration id 347564) to the ruleset's `required_status_checks` alongside `ci-success`. The ruleset JSON in `.github/rulesets/main.json` stays the source of truth and is re-applied via `gh api` (ADR-0007's mechanism).

Verified before adopting: CodeRabbit posts and completes the status on Renovate PRs too (#27, #28 both reached `success`), so bot PRs are not dead-locked by the new requirement.

## Alternatives

- **Required approving review from CodeRabbit**: CodeRabbit submits COMMENTED reviews, not approvals — a review-count rule would block every merge.
- **Keep it advisory**: the status quo; relies on a human remembering to wait, which PR #26 showed does not hold.

## Consequences

**Good**: review findings are always triaged before merge; the gate is machine-enforced, consistent with ADR-0011's prose-rules-drift lesson.

**Bad**: merge waits for CodeRabbit's queue (typically minutes); a CodeRabbit outage blocks merges — the repository-admin bypass in the ruleset remains the escape hatch.
