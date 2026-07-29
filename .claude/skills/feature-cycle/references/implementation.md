# Implementation phase

Implementation wraps the `superpowers:subagent-driven-development` executor and adds the parallelization policy the gate-package history proved out. Task-by-task execution, the resume ledger, and the red-green-refactor mechanics belong to that executor. This file states the rules the executor runs under. No feature-implement workflow script exists, by design: the phase runs entirely through the executor, which keeps the build surface small.

## Open the phase

1. **Sync.** Run the sync step from `SKILL.md`: fetch, rebase onto `main`, gate suite green, ledger hygiene. No cluster opens before it passes.
2. **Compile the outer loop, locally.** Copy the approved scenarios into `apps/desktop/e2e/features/<capability>/`, run `bddgen`, and confirm it fails on missing step definitions. That failure is the outer loop, and it has to exist before the first cluster opens so a later green means something. Capture the failing output into the phase report, then **remove the copy without committing it**.

   The red outer loop is local evidence, never a commit. `ci.yml` runs `test:e2e` on every pull request, and the repository forbids committing a failing state, so a feature file that lands without its step definitions turns the whole branch red for as long as the clusters take. The scenarios graduate for real inside the cluster that owns the end-to-end tree, together with the step definitions that answer them, so no commit is ever red. The two rules only look opposed: one asks the loop to fail before the work, the other asks the history never to record a failure. Proving it locally satisfies both.

## Cluster order

- **Contracts cluster first, alone.** The shared contract files are single collision points, so `cluster 0` lands the contracts and merges by itself before any parallel work starts.
- **Disjoint ownership only.** Two clusters run in parallel only when their file ownership does not overlap. Overlapping ownership serializes.
- **Staggered worktrees.** Each parallel cluster runs in its own worktree under `.claude/worktrees/`, created with a stagger to dodge the documented `git worktree add` race. Never place one beside the repository: `EnterWorktree` refuses to switch into a path outside that directory, so a subagent that needs to reach it can't. A fresh worktree needs no seeding step: the first `pnpm` command installs what the tree lacks, and the pre-commit prose job syncs its own styles when they are missing. Both were measured on a bare worktree, where the gate suite ran and blocked a bad commit without any manual setup.

Every cluster runs a `tdd-implementer` subagent, one per cluster, one worktree each.

## Red-run evidence

Every task stays test-first. The failing test run is captured into the task report before any implementation, and the task lands as one green commit.

An edit-time gate enforces the same rule at the tool boundary. A `PreToolUse` hook on the editing tools runs the resolver at `.claude/workflows/hooks/resolve-transcript.mts`, which hands `@nizos/probity` the acting subagent's own record when that record is on disk and falls back to the transcript the payload names when it is not. For a subagent call the payload names the parent session's transcript, so a fallback quietly restores the cross-session reading the resolver exists to prevent, and a verdict that does not match the work in hand is the symptom. The scope in `probity.config.ts` is the source trees, `apps/*/src/**` and `packages/*/src/**`, with tests, type-level specs, stories, generated modules, stylesheets, and markup outside every rule. The verdict arrives on standard output as a structured decision, and the gate returns 0 for allow and deny alike, so the exit status answers nothing.

Configuration discovery walks up from the working directory, so a worktree created before the gate landed resolves the parent checkout's `probity.config.ts` and binds the rule to the parent's trees. From inside the worktree that is indistinguishable from a gate that allows everything, because both are silent. Confirm that discovery resolves the worktree's own `probity.config.ts`, which it does when the session starts inside the worktree.

**Same session or it does not count.** The failing test run has to happen in the session that makes the edit, because the gate reads that session's record. A red run from an earlier session proves nothing to it.

The gate is a tier above the deterministic gates, never a replacement for them. Patch coverage, the diff-scoped mutation run, and the adversarial review stay the merge blockers, because a model judging an edit returns a probabilistic answer. Two limits come with that. A whitespace-only edit passes, since the gate judges a semantic behavior change rather than a byte diff. And the 120 second hook timeout probably fails open in an otherwise fail-closed design, because the best-supported reading of the exit-code contract says a hook killed for exceeding its timeout does not block. ADR-0040 records that as an inference rather than documented behavior, and a measured denial against a 3.4-megabyte transcript takes under 8 seconds, a cost that grows with the transcript, so a normal run sits far below the ceiling either way.

## Explicit test-layer tasks

Test layers are explicit tasks, not implicit hopes.

- **Unit and integration** tests stay inside their TDD clusters, driven by the red-green-refactor loop.
- **Property tests** open one task per invariant, gated on the behavior it exercises landing first.
- **End-to-end step definitions** fan out by feature file, gated on the screen or behavior they exercise landing first.

  The shared end-to-end surface lands alone and first: the fixture, the navigation steps, and the visual baselines. It carries no feature file, so nothing goes red. Then one unit per feature file runs in parallel, each owning exactly one `.feature` and one `steps/<capability>-<area>.steps.ts`, which makes their file sets disjoint by construction.

  **Each unit graduates its own feature file together with its step definitions, in one commit.** `bddgen` fails the whole tree on a single undefined step, so a feature file that lands without its steps turns the branch red for as long as the fan-out runs. That constraint is also what stops the graduation from being one big-bang step at the end.

  Writing every step definition in one late cluster is the failure mode this replaces. It serializes the largest remaining chunk of work, and it discovers an unautomatable scenario at the worst possible moment, after the set has frozen.
- **Storybook stories** are the definition of done for renderer clusters, not an afterthought. A renderer cluster closes only once someone has opened its stories through `claude-in-chrome`, in both schemes, and reported what they saw. A green story suite proves the semantics and says nothing about the appearance, which is where the defects that reach a person actually live.

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
