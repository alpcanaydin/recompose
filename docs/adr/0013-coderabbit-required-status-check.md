# 0013: CodeRabbit review as required status check

**Status**: Accepted
**Date**: 2026-07-23

## Context

CodeRabbit reviews every PR and posts a `CodeRabbit` commit status (pending while the review sits in the queue, success when it lands). But the `main` ruleset (Architecture Decision Record (ADR) 0007) required only `ci-success`. A PR could therefore merge before its review arrived. The review findings would then land on an already-merged PR, where triaging and fixing them means a follow-up branch instead of a pre-merge push. This happened in practice: PR #26 merged while its findings still awaited fixes.

## Decision

Three gates, layered:

- `CodeRabbit` (integration id 347564) added to the ruleset's `required_status_checks` alongside `ci-success`: the review must have completed.
- `required_review_thread_resolution: true`, which means a PR can't merge while any review thread stays unresolved. Resolution itself is the enforced gate; answering each finding with a fix or a reasoned skip before resolving is the project convention on top of it.
- `required_approving_review_count: 1` plus `request_changes_workflow: true` in `.coderabbit.yaml`: CodeRabbit now submits request-changes while its findings are open and flips to an approving review once every thread resolves, so the merge button stays red until that approval exists.
- `dismiss_stale_reviews_on_push: true` and `require_last_push_approval: true`: every new push voids earlier approvals, and the latest push needs approval from someone other than its pusher, so an approval always refers to the code that actually merges. (GitHub has no "every requested reviewer must approve" toggle; these two rules are its closest enforcement.)

The ruleset JSON in `.github/rulesets/main.json` stays the source of truth and is re-applied via `gh api` (ADR-0007's mechanism).

Verified before adopting: CodeRabbit posts and completes the status on Renovate PRs too (#27, #28 both reached `success`), so bot PRs aren't dead-locked by the new requirement.

## Alternatives

- **Status check + thread resolution only**: leaves the merge button green with a merely COMMENTED review; `request_changes_workflow` turns CodeRabbit into an actual approver, which the review-count rule can then require.
- **Keep it advisory**: the status quo; relies on a human remembering to wait, which PR #26 showed doesn't hold.

## Consequences

**Good**: the status check makes findings available before merge. Required thread resolution blocks merge until every finding's thread closes out. The machine enforces the pause, and the convention fills it with a fix or a reasoned skip, consistent with ADR-0011's prose-rules-drift lesson.

**Bad**: merge waits for CodeRabbit's queue (typically minutes). Every finding demands a thread reply, even when the triage is "not applicable." The single maintainer can't approve their own PRs, so CodeRabbit's approval is the only routine source of the required review. A CodeRabbit outage, a stale unresolved thread, or a missing approval blocks merges, and the repository-admin bypass in the ruleset remains the escape hatch.
