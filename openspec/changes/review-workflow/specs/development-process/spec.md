# development-process

## Purpose

The behavioral contract of the recompose feature pipeline: how a feature idea becomes a merged pull request. The feature-cycle skill implements this contract, and the pipeline's gates enforce it.

## ADDED Requirements

### Requirement: Blast-radius path guard

The pipeline MUST verify in continuous integration that a pull request touching blast-radius paths carries the `feature-cycle/reviewed` commit status on its head commit. A missing status fails the guard and names the heavy review pass as the way to clear it. The blast-radius path classes are the Electron main and preload sources, the contracts package, the storage layer, the workflow definitions, and the package manifests. The workflow definitions class spans both the continuous integration tree and the saved-workflow tree.

#### Scenario: a blast-radius pull request lacks the review marker

- When a pull request changes a blast-radius path without the `feature-cycle/reviewed` status on its head commit
- Then the path guard fails the check
- And the failure names the heavy review pass as the way to clear the guard
