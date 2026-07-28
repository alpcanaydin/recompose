# development-process

## Purpose

The behavioral contract of the recompose feature pipeline: how a feature idea becomes a merged pull request. The feature-cycle skill implements this contract, and the pipeline's gates enforce it.

## ADDED Requirements

### Requirement: Edit-time test-first gate

The pipeline MUST block an implementation edit that no failing test precedes. The gate runs at the tool boundary, so it covers the orchestrating session and every subagent under it, for a file that resolves inside the session's own checkout. The gate MUST decide that membership on the resolved path, so an aliased name for a checkout file stays in scope. A file outside that checkout is out of scope: the gate MUST read only its own checkout's configuration and MUST never load configuration from the edited file's location. The gate reads the recorded outcome of a test run, never a claim in a prompt. When a subagent acts, the gate MUST read that subagent's own record rather than the parent session's. One cluster's test run never answers for another's. The gate stays a probabilistic tier above the deterministic gates and never replaces them.

#### Scenario: an implementation edit runs ahead of its test

- When a subagent edits an in-scope source file inside the session's checkout and no failing test covers the change
- Then the gate blocks the tool call and names the missing failing test

#### Scenario: a subagent gets judged on its own record

- When the gate evaluates an edit a subagent made
- Then it reads that subagent's own record
- And a record the harness stops providing falls back to the record the payload names

#### Scenario: an edit names a checkout file through an aliased path

- When a subagent edits a file whose path reaches the session's own checkout through a symlink
- Then the gate judges it under that checkout's configuration rather than letting it pass unjudged

#### Scenario: an edit lands outside the session's checkout

- When a subagent edits a file that resolves outside the session's own checkout
- Then the gate reads its own checkout's configuration and loads none from the edited file's location
- And the edit isn't gated, so gating that worktree means running a session rooted in it

### Requirement: Gate scope

Every gate the pipeline runs MUST declare a scope and leave an action outside that scope untouched. A gate that reports failure for a path it doesn't cover is a defect, because it blocks legitimate work and teaches the pipeline to route around its own gates.

#### Scenario: a gate meets a path outside its scope

- When a gate runs against a path its own configuration excludes
- Then the gate reports success and changes nothing

## MODIFIED Requirements

### Requirement: Verification before the pull request

The pipeline MUST run two passes inside the worktree before the pull request opens: an adversarial review with a model-diverse reviewer pair and a diff-scoped mutation pass. Findings get fixed before the pull request opens. The first review pass covers the whole branch. A later pass takes the previous reviewed head as its base, so it covers the increment the earlier pass never saw.

#### Scenario: the reviewers disagree on a finding

- When the two reviewers return conflicting verdicts on a finding
- Then a judge at maximum effort settles the finding before the review status posts

#### Scenario: a fix push follows a reviewed pass

- When a fix push lands on a branch whose previous head already carries the review status
- Then the next review pass takes that previous head as its base and reviews the increment
