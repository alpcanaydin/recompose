# 0030: One exclusion list for the prose gate

**Status**: Accepted
**Date**: 2026-07-25

## Context

Architecture Decision Record (ADR) 0025 scoped the prose gate to authored markdown and left vendored skill content, execution plans, and generated output out of it. That exclusion list lived in two command-line flags: the `lint:prose` script and the continuous integration (CI) `prose` job. An editor never sees those flags. The Vale language server finds `.vale.ini` by walking up from the open file, then lints whatever the author opens. One skill file showed four errors that CI ignores, and `.claude/skills` showed 5,318 across 267 files.

## Decision

The exclusion list moves into `.vale.ini` as one glob section that clears `BasedOnStyles` and turns off every rule the `[*.md]` section promotes to error. The `--glob` flags leave the `lint:prose` script and the CI job, so the config alone defines scope.

One entry needs a different shape. The `.claude/worktrees` pattern stays relative to the repository root instead of taking the `**/` prefix the other entries carry. A command-line run from the root hands Vale a path such as `.claude/worktrees/playwright/README.md`, which the relative pattern matches. An editor hands Vale an absolute path, which it doesn't match, so a worktree opened as its own project still draws the full rule set.

## Alternatives

- **Language server settings**: the Vale language server accepts `configPath`, `filter`, `installVale`, and `syncOnStartup`. Its filter expression reads alert fields, and the alert carries no path, so a path filter is out of reach.
- **Per-directory editor settings**: Zed resolves the language server list at the worktree root rather than at the open file, so a nested settings file can't switch the server off for one folder.
- **Reassigning excluded files to plain text**: hides the errors and costs markdown highlighting in the files authors touch most.
- **Leaving the split in place**: keeps two sources of truth and teaches authors to ignore editor errors.

## Consequences

**Good**: one authority defines what the prose gate covers. Editors and CI report the same errors, so a clean editor predicts a clean gate.

**Bad**: the section repeats 19 rule names as `NO`, because clearing `BasedOnStyles` leaves the rules that `[*.md]` names outright. Promoting a rule in `[*.md]` means adding it here too, and nothing machine-checks that pairing. Vale also walks the excluded trees now instead of skipping them. A local run grew from 891 scanned files to 1,512 and stayed near one second, so the cost tracks `node_modules`.
