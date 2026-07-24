# 0011: Repository guards, forbidden owner alias, locally protected main

**Status**: Accepted
**Date**: 2026-07-22

## Context

Two project rules existed only as prose, and the folder-structure job (PR #26) violated both in practice. First, the repository owner's private alias must never appear in any artifact. Yet a committed implementation plan contained a machine-specific absolute path with the alias in it, caught only by a human-style review pass. Second, `main` stays protected, and every job lands through a PR. Yet a subagent committed directly to the local `main` branch, where GitHub's remote branch protection can't reach. Architecture Decision Record (ADR) 0010's own philosophy applies: a rule that lives only in prose drifts. A rule a machine checks doesn't.

## Decision

Encode both rules into the existing gate layers (ADR-0006 local, ADR-0007 CI) using no new tools.

- **`.gitleaks.toml` custom rule `forbidden-owner-alias`**: a case-insensitive regex for the alias, written in self-excluding character-class form so the config never matches itself. `[extend] useDefault = true` keeps all stock secret rules. `pnpm-lock.yaml` is allowlisted, because sha512 integrity hashes can contain the letter sequence. Gitleaks already runs staged in pre-commit and per-push/PR in CI, so the rule reaches both places with zero pipeline changes.
- **`.gitleaksignore`**: one fingerprint for the historical PR #26 commit whose file content was already fixed at the branch tip; without it the PR's next CI scan would fail on an unfixable-by-content commit.
- **lefthook `protect-main` pre-commit job**: fails any commit whenever `main` is the checked-out branch, in every worktree (hooks live in the shared git dir). This is the local complement to GitHub's remote protection.

## Alternatives

- **Standalone grep script wired into lefthook + CI**: works, but duplicates a scanning pipeline gitleaks already provides in both stages; more moving parts for the same coverage.
- **Case-sensitive match without the lockfile allowlist**: avoids the allowlist but misses capitalized occurrences in prose. The allowlist itself stays one line, and a generator produces the lockfile, not a person.
- **CI-only enforcement**: catches leaks only after a push makes them public in the PR. The local hook stops them before they leave the machine, and CI remains the net for `--no-verify` bypasses.

## Consequences

**Good**: both previously prose-only rules now have machine checks. Gitleaks scans file contents at commit time and again in CI on every PR diff. Local `main` refuses commits in every worktree, closing the gap remote protection can't cover.

**Bad**: commit messages, branch names, and PR titles remain unscanned (gitleaks only sees file contents). This is low-risk, because file contents, the surface that actually ships, are double-covered. Any future lockfile-style generated file that trips the rule needs its own allowlist line.
