# Verification and pull-request phase

The spec mandates two passes inside the worktree before the pull request opens, the adversarial review and the mutation pass. A rules review also runs ahead of the commit chain. Deterministic gates stay the only automated merge blockers. Both spec-mandated passes consume the finished suite, so they run side by side.

## Adversarial review

The `review-pr` saved workflow runs the adversarial review. Two `adversarial-reviewer` instances review the same diff, for deliberate model diversity and deliberate angle diversity.

- **Model diversity.** One seat keeps its `opus` default and one seat is overridden at dispatch to the most capable model, because same-model panels amplify correlated errors. The dispatch passes the `model` parameter on the Agent tool call, which overrides the definition's pin for that instance.
- **Angle diversity.** The two reviewers take distinct lenses, so coverage spans more than one failure mode.
- **The judge.** A disagreement escalates to a Fable 5 judge at maximum effort, which settles the conflicting verdicts.
- **Reproduce-or-drop.** A machine-checkable claim is either reproduced or dropped. Nothing unverified reaches the report.
- **Confidence threshold.** The report filters at a confidence threshold, starting at the code-review plugin default of 80.
- **Fix before push.** Findings get fixed before the first push, not after.

**Process assertion.** A deterministic check confirms that two distinct reviewer subagents ran before the workflow posts the review status, because orchestrators drift back to self-review. Prohibition rules stay deterministic: a rule phrased as never-do-x lives in a gate or a hook, not in a reviewer prompt, because reviewers miss negations.

## Mutation pass

The diff-scoped Stryker run executes in the worktree next to the review. A surviving mutant means a weak test. Kill it with a better test, never by lowering the threshold. The mutation gate on `main` (ADR-0036) stays the enforcing backstop.

## Rules review

Before the commit chain, a `rules-reviewer` makes one read-only pass over the diff for the CLAUDE.md and `.claude/rules/` constraints that linters cannot catch. Its findings get fixed in the worktree before the first push.

## Commit chain

Write the commit chain in caveman-commit style. The task reports carry the red runs, so the commit chain stays green at every commit. The `review-pr` workflow posts the `feature-cycle/reviewed` commit status on the reviewed head commit through `gh api`, once the process assertion passes and no finding survives.

The **path guard** runs deterministically in continuous integration. It reads the `feature-cycle/reviewed` status on the head commit. A pull request that touches blast-radius paths without that status fails the guard, which names the heavy pass as the way to clear it. A new push carries no status, so a re-review follows any change. Blast-radius paths are the Electron main and preload sources, the contracts package, storage, workflow definitions, and package manifests.

## Pull-request line

Open the pull request. On it:

- **Gate tier.** The machine gates, the compiled acceptance scenarios, and the path guard run behind the `ci-success` barrier.
- **CodeRabbit.** CodeRabbit reviews every pull request under the existing thread protocol: judge each finding against the docs and the actual code before acting, reply on the thread naming the fixing commit and resolve it, and leave a rejected or deferred finding unresolved with the reasoning until the exchange settles.

## Fix cycle

A finding closes only when its own verifier confirms the fix on the new commit, keyed by finding and commit hash. That finding-by-commit key is the convergence signal: a finding is not closed by a new commit alone, only by its verifier passing against that commit.

- Each round starts with the sync step: rebase onto `main`, rerun the local gate suite.
- Fixes apply serially within a round.
- A behavior-level finding routes back through a spec amendment with a fresh approval, never a quiet in-place patch.
- An out-of-scope discovery lands in the rider ledger, which is the outlet that keeps the fix cycle scoped.
- Three rounds cap the cycle. Survivors go to human triage.

## Merge

A human gives the final approval. The pipeline never approves its own merge. The ruleset demands `ci-success`, the CodeRabbit review, the `codecov/patch` status, CodeQL, and resolved threads. On merge, OpenSpec archives the change and folds its deltas into `openspec/specs/`. After the archive, the same pull request fills the living spec's Purpose from the archived delta, because the archive scaffolds that Purpose as TBD.
