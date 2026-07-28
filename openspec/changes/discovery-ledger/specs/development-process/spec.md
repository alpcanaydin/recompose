# development-process

## Purpose

The behavioral contract of the recompose feature pipeline: how a feature idea becomes a merged pull request. The feature-cycle skill implements this contract, and the pipeline's gates enforce it.

## ADDED Requirements

### Requirement: Out-of-scope discovery ledger

A discovery that falls outside the change in hand MUST land in the repository's issue tracker under one agreed label, rather than widening the change or disappearing. The ledger keeps a fix round scoped without losing what the round found. A later feature's discovery phase reads that ledger for prior findings that touch it.

Nothing gates the filing. A gate over it would reward noticing nothing, because that would be the cheapest way past such a check.

#### Scenario: a round surfaces something out of scope

- When a fix round surfaces a defect the change in hand doesn't cover
- Then the session files it as a labelled issue rather than repairing it in the round
- And the round continues on its own findings

#### Scenario: discovery looks for prior findings

- When the discovery phase runs its ledger arm for a feature
- Then the arm reads the labelled issues on the tracker
- And its brief reports the prior findings that touch the feature, naming issue numbers
