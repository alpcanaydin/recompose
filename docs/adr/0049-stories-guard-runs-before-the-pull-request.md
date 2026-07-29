# 0049: The stories guard runs before the pull request

**Status**: Accepted
**Date**: 2026-07-29

## Context

Every component under a `ui/` segment ships a `*.stories.tsx` sibling. The rule was real and written down, and it still failed: seven components reached a pull request without one, ninety commits after the first of them landed.

The gate that catches it lived only in the `meta` job, which runs on `pull_request` alone and reads the changed files through `gh api`. Nothing local ran it, so nothing said a word for ninety commits.

The cost compounded. A design sweep walked every story to check the type scale, the cursors, and the contrast. Seven components had no story, so the sweep walked past all seven and reported clean.

## Decision

`.claude/workflows/check-stories/check-stories.mts` owns the rule. It reads `git diff --diff-filter=A <base>...HEAD`, keeps the added files matching a `ui/` component, and reports any whose sibling story is missing from the working tree.

`pnpm run lint:stories` runs it on `pre-push` against `origin/main`. The `meta` job runs the same script against the pull request's base, so the rule has one authority rather than two implementations that drift.

The script needs no `gh api` and no dependency install: a git diff and a file check answer it, and Node runs the TypeScript directly. `meta` keeps `gh api` only for what genuinely needs the pull request, which is the `stories-exempt` label and the body line that go with it.

## Alternatives

- **Check the staged files on `pre-commit`**: a component and its story often land in one commit, but not always, and a two-commit sequence would fail the first one for no reason.
- **Leave it in continuous integration alone**: keeps a rule that only speaks after the work ends, which is what just happened.
- **Reimplement the check in lefthook shell**: two expressions of one rule, free to drift, which is the duplication the repository already forbids.

## Consequences

**Good**: the gap surfaces while the component is still open in the editor. The rule reads the same locally and in continuous integration, because it's the same file.

**Bad**: `meta` now checks out the repository and sets up Node, where before it ran on `gh api` alone. That costs a few seconds per pull request. The escape hatch stays a pull-request affair, so a local push can't take it, which is the intended asymmetry rather than an oversight.
