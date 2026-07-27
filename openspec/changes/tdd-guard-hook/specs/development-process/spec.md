# development-process

## Purpose

The behavioral contract of the recompose feature pipeline: how a feature idea becomes a merged pull request. The feature-cycle skill implements this contract, and the pipeline's gates enforce it.

## ADDED Requirements

### Requirement: Edit-time test-first gate

The pipeline MUST block an implementation edit that no failing test precedes. The gate runs at the tool boundary, so it covers the orchestrating session and every subagent under it. The gate reads the live test state that the test runner reports, never a claim in a prompt. Every edit-time gate declares a scope and leaves a path outside that scope untouched, so documents, specifications, and tooling definitions stay editable.

#### Scenario: an implementation edit runs ahead of its test

- When a subagent edits an in-scope source file and no failing test covers the change
- Then the gate blocks the tool call and names the missing failing test

#### Scenario: an edit lands outside a gate's scope

- When an edit targets a path outside an edit-time gate's declared scope
- Then that gate passes the edit through and reports no failure

## MODIFIED Requirements

### Requirement: Verification before the pull request

The pipeline MUST run two passes inside the worktree before the pull request opens: an adversarial review with a model-diverse reviewer pair and a diff-scoped mutation pass. Findings get fixed before the pull request opens. The first review pass covers the whole branch. A later pass takes the previous reviewed head as its base, so it covers the increment the earlier pass never saw.

#### Scenario: the reviewers disagree on a finding

- When the two reviewers return conflicting verdicts on a finding
- Then a judge at maximum effort settles the finding before the review status posts

#### Scenario: a fix push follows a reviewed pass

- When a fix push lands on a branch whose previous head already carries the review status
- Then the next review pass takes that previous head as its base and reviews the increment
