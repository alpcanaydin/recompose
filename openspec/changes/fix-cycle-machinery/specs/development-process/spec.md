# development-process

## Purpose

The behavioral contract of the recompose feature pipeline: how a feature idea becomes a merged pull request. The feature-cycle skill implements this contract, and the pipeline's gates enforce it.

## ADDED Requirements

### Requirement: Finding closure by verifier

A review finding MUST stay open until a verifier confirms its repair against a named commit. A repair push closes nothing on its own, because a commit that touches the area proves nothing about the finding. The verifier's verdict carries the finding and the commit it ran against, so a later reader can tell which state it judged.

#### Scenario: a repair lands without a verdict

- When a repair commit lands for an open finding and no verifier has run against it
- Then the finding stays open
- And the cycle reports it among the survivors of the round

#### Scenario: a verifier confirms a repair

- When a verifier runs against the commit carrying the repair and confirms the finding no longer holds
- Then the finding closes
- And the record names both the finding and that commit

### Requirement: Out-of-scope discovery ledger

A discovery that falls outside the change in hand MUST land in the repository's issue tracker under one agreed label, rather than widening the change or disappearing. The ledger keeps the fix cycle scoped without losing what the cycle found. A later feature's discovery phase reads that ledger for prior findings that touch it.

#### Scenario: the fix cycle finds something out of scope

- When a round surfaces a defect the change in hand doesn't cover
- Then the session files it as a labelled issue rather than repairing it in the round
- And the round continues on its own findings

#### Scenario: discovery looks for prior findings

- When the discovery phase runs its ledger arm for a feature
- Then the arm reads the labelled issues on the tracker
- And its brief reports the prior findings that touch the feature

## MODIFIED Requirements

### Requirement: Verification before the pull request

The pipeline MUST run two passes inside the worktree before the pull request opens: an adversarial review with a model-diverse reviewer pair and a diff-scoped mutation pass. Findings get fixed before the pull request opens. The first review pass covers the whole branch. A later pass takes the previous reviewed head as its base, so it covers the increment the earlier pass never saw.

The fix cycle MUST run one round at a time, repairing findings in turn and verifying each against the commit the repairs produced. A round reports its survivors and stops. Three rounds cap the cycle, and the survivors of the third go to the maintainer.

#### Scenario: the reviewers disagree on a finding

- When the two reviewers return conflicting verdicts on a finding
- Then a judge at maximum effort settles the finding before the review status posts

#### Scenario: a fix push follows a reviewed pass

- When a fix push lands on a branch whose previous head already carries the review status
- Then the next review pass takes that previous head as its base and reviews the increment

#### Scenario: a round ends with findings still open

- When a round's verifiers leave one or more findings unconfirmed
- Then the cycle reports those findings as the round's survivors
- And the maintainer decides whether another round opens
