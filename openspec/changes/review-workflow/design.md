# Review-workflow design

## Context

PR-2 merged the feature-cycle process and deferred its enforcement machinery. The skill's Enforcement rollout note lists the pipeline marker and the path guard among the checks that run by hand until a later change builds them. This document decides how PR-3 lays down two of those pieces: the `review-pr` saved workflow and the continuous integration path guard. The behavioral contract lives in the `development-process` delta in this change. The reference at `.claude/skills/feature-cycle/references/verification.md` carries the protocol the workflow and the guard implement.

## Goals and non-goals

Goals: the `review-pr` saved workflow, the path-guard script with its `ci.yml` wiring, the skill update that records the marker mechanism, and the process Architecture Decision Record (ADR). Non-goals: the Test-Driven Development (TDD) Guard hook (PR-4), the kickoff workflow script (PR-5), the citation validator, the finding-by-commit verifiers, and any product code.

## Decisions

- **The pipeline marker is a per-commit status.** The `review-pr` workflow posts a `feature-cycle/reviewed` commit status on the reviewed head commit through `gh api`, once the process assertion passes and no finding survives. A new push carries no status, so staleness self-invalidates. This matches the finding-by-commit convergence rule, where a commit closes a finding only through its own verifier. A branch-level marker or a label would survive a rewrite and certify stale code, so the per-commit status wins.

- **Guard logic lives in a unit-tested script.** A small `.claude/workflows/path-guard/path-guard.mts` decides pass or fail from two inputs: the changed-path list and the head commit statuses. It runs through Node native type stripping, and its `node:test` spec sits beside it. The typecheck borrows the desktop package compiler and its `@types` roots. A thin job step in `.github/workflows/ci.yml` feeds the script the two inputs and runs behind the `ci-success` barrier. The pure decision function stays self-contained and unit-testable, so a thick inline shell step never hides untested logic.

- **The blast-radius path set is concrete.** The guard fires on the path classes that verification.md names. The verified globs are:
  - Electron main sources: `apps/desktop/src/main/**`
  - Electron preload sources: `apps/desktop/src/preload/**`
  - contracts package: `packages/contracts/**`
  - storage layer: `apps/desktop/src/main/storage/**`
  - workflow definitions: `.github/workflows/**` and `.claude/workflows/**`
  - package manifests: `package.json`, `apps/*/package.json`, and `packages/*/package.json`

  The storage glob sits inside the main glob and appears for emphasis on the highest-value target.

- **`review-pr` is a saved workflow.** The workflow lands under `.claude/workflows/`, runnable by name. It dispatches two `adversarial-reviewer` seats, keeps one at its `opus` pin, and overrides the other to the most capable model at dispatch. A disagreement escalates to a judge at maximum effort. The workflow applies reproduce-or-drop and the confidence threshold of 80. It asserts two distinct reviewer subagents ran, then posts the status. The assertion blocks the orchestrator's drift back to self-review.

- **The trust model is drift protection, not adversarial security.** Anyone with write access can post the status through `gh api`, so the guard stops honest drift, not a determined insider. The ADR states this boundary, so no reader mistakes the guard for a security control.

## Risks / Trade-offs

- [Write access can forge the marker] → the trust model owns this, the guard targets drift, and the ADR records the boundary.
- [The mutation gate doesn't reach `.claude/workflows/path-guard/`] → the guard stays self-contained by design, and a three-case unit spec compensates for the scope exception that the ADR records.
- [The path set drifts from the real blast radius] → the guard reads the classes from one place, and a new sensitive tree lands in the same list through a reviewed change.
- [The status check adds a required gate that can wedge merges] → the heavy pass clears it in one run, and the failure message names that pass.
- [A force-push races the status] → the per-commit key ties the status to the exact head commit, so a rewrite drops it and runs the pass again.
