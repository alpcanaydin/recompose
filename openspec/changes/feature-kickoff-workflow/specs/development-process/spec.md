# development-process

## Purpose

The behavioral contract of the recompose feature pipeline: how a feature idea becomes a merged pull request. The feature-cycle skill implements this contract, and the pipeline's gates enforce it.

## ADDED Requirements

### Requirement: Citation validation

A code map MUST cite only paths and symbols the repository holds. A deterministic check decides this without a model call, because a fabricated reference is a fact about the repository rather than a judgement. A rejected code map returns to its reader once, with the failures as input.

#### Scenario: a code map cites a path the repository lacks

- When a code map names a path that doesn't exist
- Then the validator rejects the code map and names every failing citation
- And the reader runs once more with those failures as input

#### Scenario: a code map cites a symbol the named file lacks

- When a code map names a symbol its own cited file doesn't hold
- Then the validator rejects the code map and names that citation

## MODIFIED Requirements

### Requirement: Discovery before design

The pipeline MUST run discovery before the brainstorm on the full tier: technical research, codebase readers, design references, acceptance references, and a rider-ledger lookup, capped at six subagents. A citation validator rejects any code-map path or symbol that the repository lacks. The machinery that dispatches the arms MUST enforce the cap, rather than the operator running it. The arms' output MUST land in the change directory, so a later phase reads it from disk.

#### Scenario: a code map cites a missing file

- When a codebase reader cites a path missing from the repository
- Then the citation validator rejects the code map
- And the reader runs once more with the validator errors as input

#### Scenario: discovery finishes and the phase hands over

- When every dispatched arm has returned and the code map passes validation
- Then the findings sit in the change directory
- And the pipeline stops for the brainstorm, which the maintainer runs
