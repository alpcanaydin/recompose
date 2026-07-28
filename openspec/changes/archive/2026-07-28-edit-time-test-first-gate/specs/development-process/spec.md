# development-process

## Purpose

The behavioral contract of the recompose feature pipeline: how a feature idea becomes a merged pull request. The feature-cycle skill implements this contract, and the pipeline's gates enforce it.

## ADDED Requirements

### Requirement: Edit-time test-first gate

The pipeline MUST block an implementation edit that no failing test precedes. The gate runs at the tool boundary, so it covers the orchestrating session and every subagent under it, for a file inside the session's own checkout. The gate decides that membership by matching the path the payload names against globs anchored at its own configuration. That match is a string comparison rather than a filesystem one. A symlink anywhere in the path can therefore put an in-checkout edit outside the globs and leave it unjudged. The gate MUST hand its vendor the payload's action paths unchanged, because rewriting them moves the miss onto other path shapes rather than closing it. A file outside that checkout is out of scope: the gate MUST read only its own checkout's configuration and MUST never load configuration from the edited file's location. The gate reads the recorded outcome of a test run, never a claim in a prompt. When a subagent acts, the gate MUST prefer that subagent's own record over the parent session's. When no such record exists, the gate falls back to the record the payload names. For a subagent that's the parent session's. The isolation therefore holds whenever the record exists, and its absence never fails the gate closed. The gate stays an advisory tier above the deterministic gates and never replaces them, so a scoping gap degrades the advisory tier and never opens the merge.

#### Scenario: an implementation edit runs ahead of its test

- When a subagent edits an in-scope source file inside the session's checkout and no failing test covers the change
- Then the gate blocks the tool call and names the missing failing test

#### Scenario: a subagent gets judged on its own record

- When the gate evaluates an edit a subagent made
- Then it reads that subagent's own record
- And a record the harness stops providing falls back to the record the payload names

#### Scenario: the gate forwards the path the payload named

- When the gate hands a tool call to its vendor for judging
- Then it forwards the payload's action path exactly as the payload named it

#### Scenario: a symlink puts an in-checkout edit outside the gate's globs

- When a subagent edits a checkout file whose path runs through a symlink
- Then the glob match can miss and the edit lands unjudged
- And patch coverage, the diff-scoped mutation run, the adversarial review, and the path guard still hold the merge

#### Scenario: an edit lands outside the session's checkout

- When a subagent edits a file outside the session's own checkout
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
