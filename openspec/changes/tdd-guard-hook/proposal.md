# Tdd-guard-hook proposal

## Why

The pipeline states test-first discipline in prose and checks it after the fact. The implementation phase asks every task to capture a failing run before the code exists, and a reviewer reads that report later. Prose alone moves compliance little, and a reviewer who reads a finished branch can't tell a captured red run from a reconstructed one. Rollout item 4 hands the pipeline an edit-time gate that closes the window.

Two defects in the surrounding machinery block that work and land with it. The formatter hook fails any script edit under `.claude`, which today means the saved workflow script and every one that follows it. The review marker binds to one commit, so every push after a fix pays for a full heavy pass again.

## What changes

- The `@nizos/probity` gate lands as a `PreToolUse` hook, pinned exact and resolved from the workspace. It reads the session's own transcript to learn whether a failing test precedes an edit, and it blocks an implementation edit that has none. Reading the session transcript rather than a shared results file is what keeps parallel clusters honest: each worktree answers from its own record.
- A `probity.config.ts` at the repository root declares the guarded scope as an allow list, so the source trees face the gate and every other tree stays editable.
- A behavior spec drives the scope invariant for the formatter hook. The spec runs the configured hook command against sample payloads and asserts which edits pass.
- The formatter hook gains the `--no-error-on-unmatched-pattern` flag that lefthook already passes, so an ignored path stops reading as a lint failure.
- The verification phase gains the incremental re-review convention. A later `review-pr` run takes the previous reviewed head as `baseSha`, so the pass covers the increment instead of the whole branch.
- A process Architecture Decision Record (ADR) records the edit-time tier, the rejection of the predecessor tool, the scope boundary, the probabilistic trust model, and the chain ceiling the incremental convention leaves open.

## Capabilities

### New capabilities

None.

### Modified capabilities

- `development-process`: an edit-time gate blocks implementation edits that no failing test precedes, each session and worktree reads its own test outcome, every edit-time gate stays inside its own scope, and the heavy review pass runs against the increment after the first pass.

## Impact

- An implementer that reaches for code before its test meets a blocked tool call instead of a later review finding.
- The test-first rule spends a model call on each in-scope edit that misses the fast path, so the scope boundary carries the cost control.
- Script edits under `.claude` stop failing the formatter hook, which unblocks the saved-workflow tree for every future change.
- The incremental convention trades a verifiable single range for a chain of ranges the guard can't walk. The record names that ceiling and its upgrade path.
- The gate stays a probabilistic layer above the deterministic gates. Patch coverage, the mutation gate, and the path guard remain the merge blockers.
