# 0030: One exclusion list for the prose gate

**Status**: Accepted
**Date**: 2026-07-25

## Context

Architecture Decision Record (ADR) 0025 scoped the prose gate to authored markdown and left vendored skill content, execution plans, and generated output out of it. That exclusion list lived in two command-line flags: the `lint:prose` script and the continuous integration (CI) `prose` job. An editor never sees those flags. The Vale language server finds `.vale.ini` by walking up from the open file, then lints whatever the author opens. One skill file showed four errors that CI ignores, and `.claude/skills` showed 5,318 across 267 files.

## Decision

The exclusion list moves into `.vale.ini` as a glob section that clears `BasedOnStyles` and turns off every rule the `[*.md]` section promotes to error. Both readers of the config now agree on scope. The command line keeps its `--glob` flags for speed, and any editor that finds `.vale.ini` honors the same boundary.

The section omits `.claude/worktrees`. Each worktree is its own project root, and its absolute path carries that segment, so the pattern would silence Vale everywhere inside a worktree. The command-line flags keep the exclusion, because they match paths relative to the scan root.

## Alternatives

- **Language server settings**: the Vale language server accepts `configPath`, `filter`, `installVale`, and `syncOnStartup`. Its filter expression reads alert fields, and the alert carries no path, so a path filter is out of reach.
- **Per-directory editor settings**: Zed resolves the language server list at the worktree root rather than at the open file, so a nested settings file can't switch the server off for one folder.
- **Reassigning excluded files to plain text**: hides the errors and costs markdown highlighting in the files authors touch most.
- **Leaving the split in place**: keeps two sources of truth and teaches authors to ignore editor errors.

## Consequences

**Good**: one authority defines what the prose gate covers. Editors and CI report the same errors, so a clean editor predicts a clean gate.

**Bad**: the section repeats 19 rule names as `NO`, because clearing `BasedOnStyles` leaves the rules that `[*.md]` names outright. Promoting a rule in `[*.md]` means adding it here too, and nothing machine-checks that pairing. Opening a worktree from the parent repository still draws the full rule set, since the `.claude/worktrees` gap only closes on the command line.
