# Review-workflow proposal

## Why

The feature-cycle process merged and left its enforcement machinery for later. The skill defines an adversarial review pass and a deterministic path guard, yet neither one runs today. Nothing posts the pipeline marker, and continuous integration never checks for it. Rollout item 3 of the process hands that runnable machinery to this change.

## What changes

- A `review-pr` saved workflow lands under `.claude/workflows/`, runnable by name. It dispatches a model-diverse reviewer pair and escalates disagreements to a judge. It applies reproduce-or-drop and the confidence threshold, asserts two distinct reviewer subagents ran, then posts the `feature-cycle/reviewed` commit status on the reviewed head commit.
- A unit-tested `scripts/path-guard.mjs` decides pass or fail from the changed-path list and the head commit statuses. A thin job step in `.github/workflows/ci.yml` feeds the script and runs behind the `ci-success` barrier.
- The feature-cycle skill gains the concrete marker mechanism in `references/verification.md`. Its Merge section gains the post-archive step that fills the living spec's Purpose from the delta.
- A process Architecture Decision Record (ADR) records the per-commit status marker, the guard placement, the blast-radius path set, and the drift-protection trust model.

## Capabilities

### New capabilities

None.

### Modified capabilities

- `development-process`: the blast-radius path guard becomes a required continuous integration check for every pull request that touches a blast-radius path.

## Impact

- A pull request touching blast-radius paths now needs the review pass on record, so a drift back to self-review fails the guard.
- A fresh push carries no status, so a stale review self-invalidates and the heavy pass runs again.
- Write access alone can post the status. The trust model is drift protection, not adversarial security, and the ADR states so.
