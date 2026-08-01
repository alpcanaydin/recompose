# 0067: Title and label events run in their own concurrency lane

**Status**: Accepted
**Date**: 2026-08-01

## Context

The `ci` workflow answers six pull request events: `opened`, `synchronize`, `reopened`, `edited`, `labeled`, and `unlabeled`. The last three don't move a single byte of code. They exist because two jobs read the pull request itself rather than the tree. `commitlint-pr` validates the title, and `meta` reads the labels and the body to honour the `tdd-exempt`, `stories-exempt`, and `adr-exempt` escape hatches that Architecture Decision Record (ADR) 0026 introduced.

Every run shared one concurrency group, `ci-${{ github.ref }}`, with `cancel-in-progress` on for every branch but `main`.

CodeRabbit edits the pull request body while it reviews. Each edit fires `edited`, which starts a run in that one group and kills the run already going. On #112 it happened four times. Three end-to-end runners, the mutation job, and `check` died partway through and started again from nothing. The pull request then read red for minutes, on jobs that nothing had failed. Adding the `update-baselines` label fired it once more through `labeled`.

So the cost isn't one wasted matrix. It's a matrix that can't finish while a bot is reviewing, and a `ci-success` that reports failure over a cancelled sibling.

## Decision

**The concurrency group names the kind of event, so paperwork and commits queue apart.**

```yaml
group: ci-${{ github.ref }}-${{ contains(fromJSON('["edited", "labeled", "unlabeled"]'), github.event.action) && 'title-and-labels' || 'commits' }}
```

A body edit now lands in the `title-and-labels` lane. It cancels only another title-and-labels run, so the matrix already running finishes and reports what it found. A new push lands in the `commits` lane and supersedes the previous push, which is what cancellation is for.

`github.event.action` is empty on a `push`, so pushes to `main` fall to `commits` and keep the cancellation they already had, which is none.

**A paperwork run still runs every job.** That's the deliberate half of this record, and the next section says why.

## The route this record refuses

The obvious saving is to skip the expensive jobs when nothing but the title changed, with a condition on `github.event.action`. It halves the runner minutes and it opens a hole.

A job skipped by a condition doesn't stay pending. GitHub gives it the `skipped` conclusion, and a required check counts `success`, `skipped`, and `neutral` alike. ADR-0007 makes `ci-success` the only check the ruleset names, and `ci-success` already runs `if: always()` and fails only on `failure` or `cancelled`.

Put those together. A pull request whose `check` job genuinely failed gets one label. The paperwork run skips every heavy job. `ci-success` finds nothing failed among its skipped needs, so it posts green over the red. The head never moved and the code is still broken. A label would have bought a merge.

The standing rule is that no gate gets weaker. Minutes are cheaper than a gate that a label can talk out of its verdict.

## Consequences

**Good**: a review comment can no longer kill a matrix. The three end-to-end runners, the mutation job, and `check` finish what they start, so `ci-success` reflects the code rather than the timing. Nobody has to read a red pull request and work out which jobs were only cancelled. The change is one expression, and no job learned anything about which event woke it.

**Bad**: a paperwork event still runs the whole matrix, and it can now run beside a commit matrix instead of replacing it, so two full runs can overlap. Against four cancelled-and-restarted matrices on #112 that's a saving. On a quiet pull request drawing a single edit, it costs a run the old shape would have folded into the one already going.

**Watch for**: two lanes on one commit both post `ci-success`, and the last to finish wins. They test the same tree, so they agree unless something is flaky. A flaky job that fails in the later lane will mask a green earlier one, which is the ordinary flake problem rather than a new one.

## Alternatives

**Drop `edited`, `labeled`, and `unlabeled` from the trigger.** The cheapest change and the wrong one. ADR-0026 put them there so that adding `tdd-exempt` re-runs the gate that demanded it. Without them a person adds the label and the check stays red with nothing left to press.

**Skip the expensive jobs on paperwork events.** Refused above. It trades a gate for runner minutes.

**Move `meta` and `commitlint-pr` into their own workflow.** Clean on paper: the heavy workflow stops answering paperwork events at all. It needs a second required check in the ruleset, and ADR-0007 keeps `ci-success` as the only one so that adding a job never touches the ruleset. Worth revisiting only if the roll-up rule itself gets reopened.

**Condition `cancel-in-progress` on the event instead of the group.** Turning cancellation off for paperwork events leaves both kinds in one group, so a paperwork run still queues behind a commit run and delays it. The group split keeps the lanes independent.
