# Implementation phase

Implementation wraps the `superpowers:subagent-driven-development` executor and adds the parallelization policy the gate-package history proved out. Task-by-task execution, the resume ledger, and the red-green-refactor mechanics belong to that executor. This file states the rules the executor runs under. No feature-implement workflow script exists, by design: the phase runs entirely through the executor, which keeps the build surface small.

## Open the phase

1. **Sync.** Run the sync step from `SKILL.md`: fetch, rebase onto `main`, gate suite green, ledger hygiene. No cluster opens before it passes.
2. **Compile the outer loop.** The approved scenarios compile through playwright-bdd into a failing outer loop. The outer loop must be red before the first cluster opens, so it can prove green later.

## Cluster order

- **Contracts cluster first, alone.** The shared contract files are single collision points, so `cluster 0` lands the contracts and merges by itself before any parallel work starts.
- **Disjoint ownership only.** Two clusters run in parallel only when their file ownership does not overlap. Overlapping ownership serializes.
- **Staggered worktrees.** Each parallel cluster runs in its own worktree, created with a stagger to dodge the documented `git worktree add` race, and seeded by an environment setup script.

Every cluster runs a `tdd-implementer` subagent, one per cluster, one worktree each.

## Red-run evidence

Every task stays test-first. The failing test run is captured into the task report before any implementation, and the task lands as one green commit.

An edit-time gate enforces the same rule at the tool boundary. A `PreToolUse` hook on the editing tools runs the resolver at `.claude/workflows/hooks/resolve-transcript.mts`, which hands `@nizos/probity` the acting worker's own transcript, so a subagent's tool calls get judged against that subagent's record and never the parent session's. The scope in `probity.config.ts` is the source trees, `apps/*/src/**` and `packages/*/src/**`, with tests, type-level specs, stories, generated modules, stylesheets, and markup outside every rule. The verdict arrives on standard output as a structured decision, and the gate returns 0 for allow and deny alike, so the exit status answers nothing.

**Same session or it does not count.** The failing test run has to happen in the session that makes the edit, because the gate reads that session's record. A red run from an earlier session proves nothing to it.

The gate is a tier above the deterministic gates, never a replacement for them. Patch coverage, the diff-scoped mutation run, and the adversarial review stay the merge blockers, because a model judging an edit returns a probabilistic answer. Two limits come with that. A whitespace-only edit passes, since the gate judges a semantic behavior change rather than a byte diff. And a hook that exceeds its timeout counts as non-blocking, so a slow verdict lets the edit through, which is the one fail-open edge in an otherwise fail-closed design.

## Explicit test-layer tasks

Test layers are explicit tasks, not implicit hopes.

- **Unit and integration** tests stay inside their TDD clusters, driven by the red-green-refactor loop.
- **Property tests** open one task per invariant, gated on the behavior it exercises landing first.
- **End-to-end step definitions** open one task per scenario, gated on the screen or behavior it exercises landing first.
- **Storybook stories** are the definition of done for renderer clusters, not an afterthought.

**End-to-end dispatch rule.** When a task touches end-to-end tests, step definitions, or `.feature` files, dispatch it with the `playwright-best-practices` and `gherkin-best-practices` skills invoked before any writing. This is task-type-conditional loading, applied at dispatch to the tasks that need it, not a permanent preload. The `tdd-implementer` definition already carries the matching instruction.

## Merge train

A serial merge train integrates clusters one at a time:

1. Merge the next cluster.
2. Run the full suite.
3. Every remaining worktree rebases onto the new state and reruns.

A `tdd-implementer` repair subagent owns red rebases: it repairs the conflict and reruns the suite before the train continues.

## Replan

Any cluster can raise a replan when it gets stuck or its plan is invalidated. A design conflict on the merge train escalates the same way. A replan is:

1. A plan delta plus an ADR delta.
2. A human micro-approval.
3. A version broadcast to the other clusters, so they rebase onto the new plan.

## Close the phase

The outer loop must go green on mock traffic before the phase ends. Green there unlocks [verification.md](verification.md).
