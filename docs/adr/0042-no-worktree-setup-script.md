# 0042: Worktree seeding stays with the toolchain

**Status**: Accepted
**Date**: 2026-07-28

## Context

Architecture Decision Record (ADR) 0038 defined the feature cycle, and its implementation phase runs parallel clusters in separate worktrees. The phase reference promised that each worktree arrives "seeded by an environment setup script," and the skill's rollout note listed that script among the machinery still to build. Neither the script nor a decision to skip it existed, so the next contributor would have built one.

The premise behind the promise was that a fresh worktree can't run the gates. It has no `node_modules` for the type check and the formatter, and no synced styles for the prose linter. Both halves turned out to be wrong, and measurement settled it.

## Decision

recompose ships no worktree setup script. A fresh worktree seeds itself through the toolchain already in place.

Three measurements on a worktree created with `git worktree add` and touched no other way:

- The tree does start without `node_modules`, as expected.
- `pnpm run typecheck` succeeded in that state and left `node_modules` populated behind it, so the first package-manager command installs what the tree lacks.
- A commit in that same untouched state ran the full pre-commit suite and blocked a bad change planted for the purpose, with the spell and prose jobs reporting the failures. The prose job carries its own staleness check, `test .vale/styles/Microsoft -nt .vale.ini || mise exec -- vale sync`, so the missing styles synced without anyone asking.

A script would therefore automate what already happens. The phase reference now states what the toolchain does instead of promising a file, and the rollout note no longer lists the script as deferred.

## Alternatives

- **A `post-checkout` hook seeding every fresh linked worktree.** Rejected. Git does fire `post-checkout` on `git worktree add` with a null previous reference, and a hook would reach the worktrees a script can't, including the ones the platform creates for isolated subagents. A probe confirmed both facts rather than assuming them. The hook still automates a step that needs no automation, and it carries a bootstrap problem of its own. The hook runner resolves from `node_modules`, which is the one thing the hook would install.
- **A repository-local `worktree:new` script**, matching what the package manager's own maintainers keep in their monorepo. Rejected for the same reason, with the added limit that it reaches only the worktrees a person opens by hand.
- **Leaving the promise in place.** Rejected. A record that describes a file nobody wrote is the failure this project has paid for most often, and it sends the next reader looking for something that was never built.

## Consequences

**Good**: nothing new to maintain, and the phase reference now describes behavior a reader can verify in one command. The rollout note shrinks to the two items that remain genuinely absent, the finding-by-commit verifiers and the rider ledger.

**Bad, and accepted**: the self-healing install is the package manager's behavior rather than a contract this repository owns, so a future version could change it. A bare worktree would then fail its first command outright, which is a symptom nobody can miss. The concurrent-creation race on the shared configuration lock also stays unmitigated. It needs three or more simultaneous worktree creations to appear, the phase reference already calls for a stagger, and no run in this repository has hit it.
