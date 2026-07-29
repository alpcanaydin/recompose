# 0051: The review status guard stops blocking the merge

**Status**: Accepted
**Date**: 2026-07-29

## Context

`path-guard` fails whenever a change touches a blast-radius path without a `feature-cycle/reviewed` status on the head commit, and it sat inside the `needs` list of `ci-success`, which is a required status. That made the heavy adversarial review a merge blocker on any change reaching the main process, the preload bridge, the contracts package, or either workflow directory.

The review earns its place. Across the settings-screen change it ran three times and reproduced a real defect on every pass, twice in code that a previous pass had just repaired. What it can't do is settle. Each repair moves the head commit and the status stays bound to the commit it reviewed. The guard then asks for a review of a commit that already carries the fix the last review asked for. A change large enough to need the review is a change whose fixes keep outrunning it.

The status also comes from a workflow a maintainer starts by hand, so a branch can't clear the guard from inside continuous integration.

## Decision

`path-guard` leaves the `needs` list of `ci-success`. The job still runs on every pull request and still reports its own status, so the signal survives. It no longer decides whether the branch can merge.

## Alternatives

- **Keep it required**: the guard holds a large change until its fixes stop arriving, and the last review round found only a defect the round before it introduced.
- **Delete the job**: throws away a signal that reproduced six defects no linter saw.
- **Bind the status to the branch rather than the commit**: a review of an older tree would vouch for code nobody read, which is worse than no status.
- **Post the status from continuous integration**: the review needs judgement the runner doesn't have, and a self-posted status vouches for nothing.

## Consequences

**Good**: a branch can land once its machine gates are green, and the review stays available as the thing that finds what those gates miss.

**Bad**: nothing now stops a blast-radius change from merging with nobody having read it. The guard's own report is the reminder, and a maintainer reads it rather than a gate. Restoring the requirement is a one-line change to the `needs` list once the review can bind its status to a moving head.
