# development-process Specification

## Purpose

The behavioral contract of the recompose feature pipeline: how a feature idea becomes a merged pull request. The feature-cycle skill implements this contract, and the pipeline's gates enforce it.

## Requirements

### Requirement: Tier classification

The pipeline MUST classify every feature request as trivial, standard, or full before any other phase, and the maintainer must confirm the tier. A classifier recommends the tier through a written rubric and fills the structured fields. The pipeline allows mid-flight tier upgrades and forbids silent downgrades.

#### Scenario: the maintainer confirms a recommended tier

- When the classifier recommends a tier with its rubric reasons
- Then the pipeline waits for the maintainer's confirmation or override before discovery starts
- And the confirmed tier lands in the change manifest

### Requirement: Citation validation

A code map MUST cite only paths that resolve inside the repository and symbols that appear in the file each one names. A deterministic check decides this without a model call, because a fabricated reference is a fact about the repository rather than a judgement. A standalone token in the file's text satisfies the symbol rule, so the check proves a mention rather than a declaration or an export. A rejected code map returns to its reader once, with the failures as input.

#### Scenario: a code map cites a path the repository lacks

- When a code map names a path that doesn't exist
- Then the validator rejects the code map and names every failing citation
- And the reader runs once more with those failures as input

#### Scenario: a code map cites a symbol the named file lacks

- When a code map names a symbol its own cited file doesn't hold
- Then the validator rejects the code map and names that citation

### Requirement: Discovery before design

The pipeline MUST run discovery before the brainstorm on the full tier, across five lines of enquiry: technical research, codebase readers, design references, acceptance references, and a rider-ledger lookup. Four of them dispatch subagents, because the design-reference line runs in the orchestrating session where its tools live. A citation validator rejects any code-map path or symbol that the repository lacks.

The fan-out MUST stay within six subagents, and the machinery that dispatches it MUST enforce that number rather than the operator running it. The six covers the fan-out: the four dispatched arms, the subagent that writes their output, and the one that runs the validator. A rerun after a rejected code map repairs the fan-out rather than extending it, so its dispatches sit outside the cap. The arms' output MUST land in the change directory, so a later phase reads it from disk.

#### Scenario: a code map cites a missing file

- When a codebase reader cites a path missing from the repository
- Then the citation validator rejects the code map
- And the reader runs once more with the validator errors as input

#### Scenario: discovery finishes and the phase hands over

- When every dispatched arm has returned and the code map passes validation
- Then the findings sit in the change directory
- And the pipeline stops for the brainstorm, which the maintainer runs

### Requirement: Human approval gates

Every planning artifact MUST pass a human gate before downstream work consumes it. Each gate returns approve, reject with notes, or park. A rejection regenerates only the rejected artifact and keeps approved siblings frozen. The scenario set freezes at the second approval, and later changes go through a spec amendment with a fresh approval.

#### Scenario: the maintainer rejects one artifact

- When the maintainer rejects the solution design with notes and the design document stays approved
- Then the pipeline regenerates only the solution design with the notes as input

### Requirement: Implementation discipline

The pipeline MUST implement through the subagent-driven executor with the parallelization policy. The contracts cluster merges alone first. Only clusters with disjoint file ownership run in parallel, and a serial merge train integrates them. Every task captures its failing test run in the task report and lands as one green commit, and property tests, step definitions, and stories are explicit tasks.

#### Scenario: two clusters touch the same file

- When the plan assigns one file to two clusters
- Then the clusters run serially instead of in parallel

### Requirement: Verification before the pull request

The pipeline MUST run two passes inside the worktree before the pull request opens: an adversarial review with a model-diverse reviewer pair and a diff-scoped mutation pass. Findings get fixed before the pull request opens. The first review pass covers the whole branch. A later pass takes the previous reviewed head as its base, so it covers the increment the earlier pass never saw.

#### Scenario: the reviewers disagree on a finding

- When the two reviewers return conflicting verdicts on a finding
- Then a judge at maximum effort settles the finding before the review status posts

#### Scenario: a fix push follows a reviewed pass

- When a fix push lands on a branch whose previous head already carries the review status
- Then the next review pass takes that previous head as its base and reviews the increment

### Requirement: Out-of-scope discovery ledger

A discovery that falls outside the change in hand MUST land in the repository's issue tracker, as an open issue carrying the `rider` label. It neither widens the change nor disappears. The entry MUST name the defect in its title. Its body MUST name where the discovery surfaced and why it fell outside the change in hand, because a later reader judges relevance from that text. The ledger keeps a fix round scoped without losing what the round found.

Nothing gates the filing. A gate over it would reward noticing nothing, because that would be the cheapest way past such a check.

#### Scenario: a round surfaces something out of scope

- When a fix round surfaces a defect the change in hand doesn't cover
- Then the session files it as a labelled issue rather than repairing it in the round
- And the round continues on its own findings

#### Scenario: discovery looks for prior findings

- When the discovery phase runs its ledger arm on the full tier
- Then the arm reads the labelled issues on the tracker
- And its brief reports the prior findings that touch the feature, naming issue numbers

#### Scenario: the lookup fails to reach the tracker

- When the ledger lookup fails to reach the tracker
- Then the arm reports the failure rather than an empty ledger
- And no reader treats the absence of findings as evidence that none exist

### Requirement: Merge policy

Deterministic gates MUST stay the only automated merge blockers, and the maintainer must give the final approval. The pipeline never approves its own merge.

#### Scenario: all checks pass without human approval

- When every required status is green and no human approval exists
- Then the pull request stays open

### Requirement: Change hygiene

Every change directory MUST carry at least one spec delta with a scenario from its creation, because validation fails a change with no deltas. Meta changes that alter the development process itself write their deltas into the `development-process` capability.

#### Scenario: a change starts its life

- When the pipeline creates a change directory
- Then the same commit adds a spec delta with at least one scenario
- And the validation gate stays green on every commit

### Requirement: Adversarial review before the pull request

The pipeline MUST run the heavy adversarial review on the working tree before a pull request opens. It MUST NOT tie that review to any continuous integration check or commit status. The review answers with the findings that survived. The session fixes each surviving finding on the branch, then pushes once the review answers with none. Continuous integration therefore judges what the machine gates can judge, and the review stays the pass that finds what those gates miss.

#### Scenario: the review finds a defect before the branch leaves the machine

- When the heavy adversarial review answers with a surviving finding
- Then the session fixes the finding on the branch before the pull request opens
- And no continuous integration check waits on the review

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
- And patch coverage and the diff-scoped mutation run still hold the merge

#### Scenario: an edit lands outside the session's checkout

- When a subagent edits a file outside the session's own checkout
- Then the gate reads its own checkout's configuration and loads none from the edited file's location
- And the edit isn't gated, so gating that worktree means running a session rooted in it

### Requirement: Gate scope

Every gate the pipeline runs MUST declare a scope and leave an action outside that scope untouched. A gate that reports failure for a path it doesn't cover is a defect, because it blocks legitimate work and teaches the pipeline to route around its own gates.

#### Scenario: a gate meets a path outside its scope

- When a gate runs against a path its own configuration excludes
- Then the gate reports success and changes nothing
