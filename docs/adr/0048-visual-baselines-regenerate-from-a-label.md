# 0048: Visual baselines regenerate from a pull-request label

**Status**: Accepted
**Date**: 2026-07-29

## Context

The visual project pins each screen against a per-platform baseline, and continuous integration runs it on macOS, Windows, and Linux. A screen that gains a row invalidates the baselines on all three, and a new screen has none. A measurement settled what happens next. Hiding `settings-darwin.png` turned the visual project red, rather than writing the file and passing.

Only a runner can produce those images. Nothing on a maintainer's macOS machine renders like Windows. Linux would match only if continuous integration ran the same container image, which it doesn't. So the branch has to reach GitHub before its baselines can exist. That costs nothing extra, because opening a pull request already requires the push.

The trigger did cost something. `update-visual-baselines` ran on `workflow_dispatch` alone, so the sequence was push, watch two platforms go red, remember the workflow, type the branch name, wait, then push again. The red in the middle reported a missing artifact rather than broken code, which is the one thing this repository asks a red check never to mean.

## Decision

`update-visual-baselines` also triggers on `pull_request` with `types: [labeled]`, and runs for the label `update-baselines`.

The `branch` input turns optional. Both jobs resolve their checkout from `inputs.branch || github.event.pull_request.head.sha`, and the push target resolves from `inputs.branch || github.event.pull_request.head.ref` through an environment variable rather than an inline expansion. The head reference is attacker-controlled text on a fork, so it reaches the shell as data.

The job also refuses a fork: it runs only when `github.event.pull_request.head.repo.full_name` matches the repository. A fork's token carries no write scope, so the push would fail after paying for three runners.

## Alternatives

- **Leave it on `workflow_dispatch` alone**: keeps a red check meaning "an artifact is missing," rather than "the code broke," and asks a person to remember a second workflow and retype a branch name they're already looking at.
- **Trigger on `pull_request` unconditionally**: three runners on every push, for a job that matters a handful of times per branch.
- **Let the visual job write its own missing baselines and pass**: a new screen would then ship with no baseline and no signal, which trades a loud wrong answer for a silent one.
- **Comment trigger, `/update-baselines`**: the `issue_comment` event fires on every comment in the repository and gets filtered inside the job, so the wiring is noisier than a label for the same result.
- **Generate Linux baselines locally in a container**: would need continuous integration to run that same image, which is a larger change, and Windows has no equivalent escape.

## Consequences

**Good**: one label closes the gap, applied from the pull request that needs it, with no branch name to retype. Fork pull requests stop burning three runners on a push that can't land.

**Bad**: the repository token can't start a workflow run, which GitHub enforces to stop workflows from triggering themselves. So the bot's baseline commit lands but starts no run, and the branch needs one more push or a re-run before it reads green. The job prints that instruction as a notice, so nobody has to rediscover it. Closing the gap for good needs a GitHub App token, which is a separate decision with its own setup.

A second ceiling: the label stays on after the run. Regenerating again means removing it and adding it back.
