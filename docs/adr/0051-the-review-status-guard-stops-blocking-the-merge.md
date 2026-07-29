# 0051: The adversarial review leaves continuous integration

**Status**: Accepted
**Date**: 2026-07-30

Supersedes [0039](0039-review-pass-marker-and-path-guard.md).

## Context

Architecture Decision Record (ADR) 0039 wired the heavy adversarial review into the merge path. The `review-pr` workflow posted a `feature-cycle/reviewed` commit status, a `path-guard` job read that status on the head commit, and `ci-success` required the job. A pull request touching the main process, the preload bridge, the contracts package, the storage layer, a workflow definition, or a package manifest couldn't merge without it.

The review earns its keep. Across the settings-screen change it ran three times and reproduced a real defect on every pass, twice in code that a previous pass had just repaired. Six defects no linter saw came out of it.

The wiring is what failed. A status binds to a commit, and every fix the review asks for moves the head. The branch then arrives at a guard demanding a review of a commit that already carries the answer the last review gave. The workflow also runs by hand, so nothing inside continuous integration can clear the guard it fails. The result is a gate a large change can't satisfy and a small change never needed, which measures the size of a diff rather than the quality of it.

## Decision

The review runs on the working tree before a pull request exists, and it has no counterpart in continuous integration.

- `review-pr` posts no commit status. It answers with the findings that survived, and a session fixes them on the branch before pushing.
- The `path-guard` job leaves `.github/workflows/ci.yml`, and `.claude/workflows/path-guard/` leaves the tree.
- The living process spec carries the discipline as a requirement about when the review runs, not as a check anything reads.

## Alternatives

- **Keep the guard required**: the case this record answers. A large change waits until its fixes stop arriving, and the last round found only a defect the round before it introduced.
- **Keep the job but drop it from `ci-success`**: the first attempt. A job whose red nobody acts on trains everyone to ignore red, which is worse than no job.
- **Bind the status to the branch rather than the commit**: a review of an older tree vouches for code nobody read.
- **Post the status from continuous integration**: the review needs judgement the runner doesn't have, and a self-posted status vouches for nothing.

## Consequences

**Good**: a branch lands once its machine gates are green. The review moves to where its findings are cheapest to act on, which is before anyone else looks at the diff. A fix no longer invalidates the pass that asked for it.

**Bad**: nothing mechanical now proves anyone read a blast-radius change. The discipline lives in the feature-cycle reference and in whoever runs the pipeline. A session that skips the review leaves no trace of the skip, and finding that out means reading the transcript rather than a check. Restoring a gate means solving the moving-head problem first, which this record doesn't attempt.
