# Edit-time-test-first-gate proposal

## Why

The pipeline states test-first discipline in prose and checks it after the fact. The implementation phase asks every task to capture a failing run before the code exists, and a reviewer reads that report later. A reviewer holding a finished branch can't tell a captured red run from a reconstructed one. Rollout item 4 hands the pipeline an edit-time gate that closes the window.

Getting there took two tool reversals and one measurement, and the record carries both. The tool the rollout note named steers new projects elsewhere and keeps test state in one shared directory, which parallel worktree clusters would corrupt. Its successor carries no shared state. A live probe then showed a subagent's hook payload hands over the parent session's transcript. The gate would judge an implementer against a record holding none of that implementer's work. The payload does carry the subagent's identity, and the per-subagent record sits at a path derived from it, so a small resolver closes the gap.

Two defects in the surrounding machinery block this work and land with it. The formatter hook fails any script edit under `.claude`, which is where this change writes. The review marker binds to one commit, so every push after a fix pays for a full whole-branch review again.

## What changes

- `@nizos/probity` pins exact as a root development dependency, and a `PreToolUse` hook runs it from the workspace. It reads the calling session's transcript to learn whether a failing test precedes an edit, and blocks an implementation edit with none.
- A transcript resolver sits between the hook and the gate. It reads the payload, and when the payload names a subagent it rewrites the transcript path to that subagent's own record. A missing record falls back to the payload's own path, so a future harness change degrades to today's behavior instead of breaking. The resolver is a pure function with its own specification.
- A `probity.config.ts` at the repository root declares the guarded scope as an allow list, so the source trees face the gate and every other tree stays editable.
- The formatter hook gains the `--no-error-on-unmatched-pattern` flag that lefthook already passes, so a path the linter ignores stops reading as a lint failure. A behavior spec drives that scope invariant.
- The verification phase gains the incremental re-review convention. A later `review-pr` run takes the previous reviewed head as `baseSha`, so the pass covers the increment instead of the whole branch.
- A process Architecture Decision Record (ADR) records both tool evaluations, the measurement, the resolver and its ceiling, the probabilistic trust model, and the review-chain ceiling.

## Capabilities

### New capabilities

None.

### Modified capabilities

- `development-process`: an edit-time gate blocks implementation edits that no failing test precedes, each subagent gets judged against its own record, every gate stays inside its declared scope, and the heavy review pass runs against the increment after the first pass.

## Impact

- An implementer that reaches for code before its test meets a blocked tool call instead of a later review finding.
- The gate spends a model call on each in-scope edit that misses the fast path, so the allow list carries the cost control.
- The resolver depends on a path convention the harness doesn't document. It falls back rather than failing, and its specification covers both branches.
- Script edits under `.claude` stop failing the formatter hook, which unblocks the saved-workflow tree for every future change.
- The gate stays a probabilistic layer above the deterministic gates. Patch coverage, the mutation gate, and the path guard remain the merge blockers.
- The incremental convention trades a verifiable single range for a chain of ranges the guard can't walk. The record names that ceiling and its upgrade path.
