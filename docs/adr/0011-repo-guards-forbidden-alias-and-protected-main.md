# ADR-0011: Repo Guards — Forbidden Owner Alias, Locally Protected Main

**Status**: Accepted
**Date**: 2026-07-22

## Context

Two project rules existed only as prose and both were violated in practice during the folder-structure job (PR #26). First, the repository owner's private alias must never appear in any artifact — yet an implementation plan was committed containing a machine-specific absolute path with the alias in it, caught only by a human-style review pass. Second, `main` is protected and every job lands through a PR — yet a subagent committed directly to the local `main` branch, where GitHub's remote branch protection cannot reach. ADR-0010's own philosophy applies: a rule that lives only in prose drifts; a rule a machine checks does not.

## Decision

Encode both rules into the existing gate layers (ADR-0006 local, ADR-0007 CI) — no new tools.

- **`.gitleaks.toml` custom rule `forbidden-owner-alias`**: a case-insensitive regex for the alias, written in self-excluding character-class form so the config never matches itself. `[extend] useDefault = true` keeps all stock secret rules. `pnpm-lock.yaml` is allowlisted — sha512 integrity hashes randomly contain the letter sequence. Because gitleaks already runs staged in pre-commit and per-push/PR in CI, the rule is enforced in both places with zero pipeline changes.
- **`.gitleaksignore`**: one fingerprint for the historical PR #26 commit whose file content was already fixed at the branch tip; without it the PR's next CI scan would fail on an unfixable-by-content commit.
- **lefthook `protect-main` pre-commit job**: fails any commit while `main` is checked out, in every worktree (hooks live in the shared git dir). This is the local complement to GitHub's remote protection.
- **lefthook `forbidden-alias` commit-msg job**: a grep over the message file, since gitleaks does not scan commit messages.

## Alternatives

- **Standalone grep script wired into lefthook + CI**: works, but duplicates a scanning pipeline gitleaks already provides in both stages; more moving parts for the same coverage.
- **Case-sensitive match without the lockfile allowlist**: avoids the allowlist but misses capitalized occurrences in prose; the allowlist is one line and the lockfile is generated content.
- **CI-only enforcement**: catches leaks after they are pushed and public in the PR; the local hook stops them before they leave the machine, and CI remains the net for `--no-verify` bypasses.

## Consequences

**Good**: both previously prose-only rules now have machine checks — file contents are scanned at commit time and again in CI on every PR diff; commit messages are checked by the local commit-msg hook; local `main` refuses commits in every worktree, closing the gap remote protection cannot cover.

**Bad**: the banned pattern is encoded twice (gitleaks regex and commit-msg grep) because gitleaks cannot see commit messages; commit messages have no CI net — the local hook is bypassable with `--no-verify`, accepted because file contents (the surface that actually ships) are double-covered; any future lockfile-style generated file that trips the rule needs its own allowlist line; branch names and PR titles remain unscanned — accepted as low-risk until proven otherwise.
