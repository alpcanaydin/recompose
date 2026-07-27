# 0039: The review marker and the blast-radius path guard

**Status**: Accepted
**Date**: 2026-07-27

## Context

This Architecture Decision Record (ADR) follows ADR-0038, which defined the feature cycle as an executable process. That record left the cycle's enforcement to hand-run checks. Its rollout note listed the pipeline marker and the path guard among the pieces a later change would build. This record closes two of them.

The heavy adversarial review runs by hand today, so nothing stops an author from merging a sensitive change without it. This change lays down the saved workflow that runs the review, the per-commit marker it posts, and the continuous integration guard that reads the marker. The behavioral contract lives in the `development-process` capability under `openspec/specs/`, and this record captures the decisions behind the files that carry it.

## Decision

recompose enforces the heavy review through a per-commit status and a deterministic continuous integration guard. A saved workflow posts the status, and a unit-tested script decides the guard.

- **The marker is a per-commit status.** The `review-pr` workflow posts a `feature-cycle/reviewed` status on the reviewed head commit through the GitHub status API. The post happens once the process assertion passes and no finding survives. A new push carries no status, so staleness self-invalidates. This matches the finding-by-commit rule, where a commit closes a finding only through its own verifier. A branch marker or a label would survive a rewrite and certify stale code, so the per-commit status wins.
- **`review-pr` is a saved workflow with reviewer diversity.** The workflow lives at `.claude/workflows/review-pr.js` and runs by name. It dispatches two `adversarial-reviewer` seats over the same diff. One seat holds its `opus` pin, and the other takes the most capable model at dispatch. Each seat reproduces or drops every candidate defect and keeps only findings at confidence 80 or above. A disagreement escalates to a judge at maximum effort. The workflow asserts two distinct reviewer subagents ran, then posts the status. That assertion blocks the orchestrator's drift back to self-review.
- **The guard's decision lives in a unit-tested script.** A pure function in `.claude/workflows/path-guard/path-guard.mts` decides pass or fail from two inputs: the changed-path list and the head commit statuses. A thin `path-guard` job in `.github/workflows/ci.yml` feeds the script those inputs and runs behind the `ci-success` barrier. The pure function stays self-contained, so a thick inline shell step never hides untested logic.
- **The blast-radius path set is concrete.** The guard fires on the sensitive path classes:
  - the Electron main sources, `apps/desktop/src/main/**`
  - the preload sources, `apps/desktop/src/preload/**`
  - the storage layer, `apps/desktop/src/main/storage/**`
  - the contracts package, `packages/contracts/**`
  - the workflow trees, `.github/workflows/**` and `.claude/workflows/**`
  - the package manifests, `package.json`, `apps/*/package.json`, and `packages/*/package.json`

  The storage glob sits inside the main glob and marks the highest-value target. The `.claude/workflows/**` glob covers the guard's own tree, so a change to the guard demands the marker like any other sensitive change.

- **The trust model is drift protection, not adversarial security.** Anyone with write access can post the status through the GitHub status API, so the guard stops honest drift, not a determined insider. This record states the boundary, so no reader mistakes the guard for a security control.
- **Feature-cycle machinery lives under `.claude/workflows/`.** Saved workflows sit at the top level, and supporting machinery sits in subdirectories, so the workflow registry scan skips the helpers. The `scripts/` tree keeps only generic repo tooling next to `check-licenses.mjs`. The workflow tree carries the Vale, cspell, and knip exemptions, so its dispatch tables and tool syntax skip the prose and dead-code gates.
- **Tooling is TypeScript, checked without root dependencies.** The `.mts` files run through Node 24 native type stripping with erasable-only syntax, so no build step precedes them. The `typecheck:workflows` script borrows the desktop package's compiler and its `@types` roots, then chains into the root `typecheck`. An earlier attempt added the compiler to the root and broke steiger, which re-resolved its config loader to the wrong compiler through pnpm peer resolution. The borrow pattern keeps root dependencies untouched.
- **The mutation-scope exception carries a compensating cover.** The diff-scoped Stryker gate mutates only the contracts and Electron-main trees, so the guard sits outside its reach. The guard takes the documented exception route rather than a weakened threshold. A three-case unit spec compensates: a blast-radius hit without the marker, a blast-radius hit with the marker, and a clean path that skips the guard.
- **Committed red states end.** The repo squash-merges, so a red-then-green commit pair never reaches `main`, and a committed red commit breaks branch bisect for no gain. The proof of test-first work moves to the captured red run in the task report, and each task lands as one green commit. This amendment travels in this change's `development-process` delta.

## Alternatives

- **A branch marker or a pull-request label**: rejected. Either one survives a force-push and certifies stale code. The per-commit status drops on a rewrite, so the review runs again on the real head.
- **A thick inline shell step in `ci.yml`**: rejected. Guard logic inside a job step never runs under a test. The pure function in a script stays unit-testable, and the three-case spec proves the decision.
- **The guard under `scripts/`**: rejected. The design first placed it there. The workflow registry scan and the mutation scope both center on real product trees, so the guard belongs beside the workflow it enforces, under `.claude/workflows/path-guard/`.
- **Root compiler dependencies for the typecheck**: rejected. Adding the compiler to the root re-resolved steiger's config loader through pnpm peer resolution and broke the boundary gate. Borrowing the desktop compiler checks the same types with no graph change.
- **A committed failing test as red proof**: rejected. A squash merge discards it, and a red commit on the branch breaks bisect. The captured red run in the task report proves the same discipline without a broken commit.

## Consequences

**Good**: a sensitive change can't merge without the heavy review, because the guard reads a marker that only a passing review posts. The per-commit key ties the marker to the exact head commit, so a force-push runs the review again. The decision function carries a unit spec, so its logic stays honest under change. The workflow tooling ships as plain TypeScript with no build step and no root dependencies.

**Bad, and accepted**: write access can forge the marker, and the trust model owns that boundary. The blast-radius set can drift from the real sensitive surface, and a new tree lands in the same list through a reviewed change. The guard sits outside the mutation gate, so the three-case spec is its only cover. A required status check can wedge a merge, and the failure message names the review pass that clears it.

**One operational hazard shaped the tree**: the oxfmt PostToolUse hook corrupted a `.claude/workflows/` file with a null byte during development. Byte-level verification now follows any write under that tree.
