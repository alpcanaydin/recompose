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

### Requirement: Discovery before design

The pipeline MUST run discovery before the brainstorm on the full tier: technical research, codebase readers, design references, acceptance references, and a rider-ledger lookup, capped at six subagents. A citation validator rejects any code-map path or symbol that the repository lacks.

#### Scenario: a code map cites a missing file

- When a codebase reader cites a path missing from the repository
- Then the citation validator rejects the code map
- And the reader runs once more with the validator errors as input

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

The pipeline MUST run two passes inside the worktree before the pull request opens: an adversarial review with a model-diverse reviewer pair and a diff-scoped mutation pass. Findings get fixed before the pull request opens.

#### Scenario: the reviewers disagree on a finding

- When the two reviewers return conflicting verdicts on a finding
- Then a judge at maximum effort settles the finding before the review status posts

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

### Requirement: Blast-radius path guard

The pipeline MUST verify in continuous integration that a pull request touching blast-radius paths carries the `feature-cycle/reviewed` commit status on its head commit. A missing status fails the guard and names the heavy review pass as the way to clear it. The blast-radius path classes are the Electron main and preload sources, the contracts package, the storage layer, the workflow definitions, and the package manifests. The workflow definitions class spans both the continuous integration tree and the saved-workflow tree.

#### Scenario: a blast-radius pull request lacks the review marker

- When a pull request changes a blast-radius path without the `feature-cycle/reviewed` status on its head commit
- Then the path guard fails the check
- And the failure names the heavy review pass as the way to clear the guard
