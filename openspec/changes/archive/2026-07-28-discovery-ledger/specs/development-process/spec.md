# development-process

## Purpose

The behavioral contract of the recompose feature pipeline: how a feature idea becomes a merged pull request. The feature-cycle skill implements this contract, and the pipeline's gates enforce it.

## ADDED Requirements

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
