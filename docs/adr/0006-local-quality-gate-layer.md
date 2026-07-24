# 0006: Local quality gate layer

**Status**: Accepted
**Date**: 2026-07-21

## Context

A gate inventory of three internal reference repos (an API service, a web app, and an infra monorepo) surfaced ~40 quality/safety gates across six firing stages. Those stages are session edit-time, session stop-time, commit, CI, post-merge, and platform config. recompose has no remote repo yet, so only the local stages can run and get verified today. Design spec: `docs/superpowers/specs/2026-07-21-local-quality-gates-design.md`.

## Decision

Adopt the local layer now. Defer CI, branch protection, and Renovate to when the GitHub remote exists.

- **Stop hook**: two independent Opus reviewers, one for rules compliance and one for security (Electron posture, Inter-Process Communication (IPC) surface, provider-key discipline, committed secrets). Each keeps its own review marker (`.git/claude-reviewed`, `.git/claude-security-reviewed`); a shared marker would drop one reviewer's diff whenever the other passes and advances it.
- **lefthook pre-commit**, sequential with `priority` + `stage_fixed`: gitleaks staged secret scan (self-bootstraps via `brew install gitleaks` on a fresh clone, fails with a clear error if still missing) → `oxlint --fix --deny-warnings` → `oxfmt` (fix-and-restage instead of `--check`) → `pnpm run typecheck`.
- **commit-msg**: `commitlint` with `@commitlint/config-conventional`, `type-enum` restricted to the 11 caveman-commit types. This decision favors the package over an inline regex, so phase 2 CI can reuse the same config for the PR-title gate.
- **PreToolUse guards**: the hook denies edits to `.env*` (except `.env.example`) and key material (`*.pem`, `*.key`, `*.p12`, `id_rsa*`, `id_ed25519*`); it blocks Bash commands containing `--no-verify`/`--no-gpg-sign` so Claude Code can't bypass the commit gates.

A fresh clone needs nothing beyond `pnpm install`: every gate except gitleaks is an npm devDependency, and the gitleaks job installs itself.

## Alternatives

- **Inline Portable Operating System Interface (POSIX) regex for commit messages**: zero deps, but the gate would be rewritten as commitlint anyway when CI needs PR-title validation.
- **One combined Stop reviewer**: cheaper per stop, but security findings drown in style findings and one prompt serves two masters; the split proved cleaner in the reference repos.
- **Gate fixture test suite**: skipped, because the hooks are one-liners; each was pipe-tested and proven with an injected violation instead.

## Consequences

**Good**: secrets can't reach a commit (gitleaks) or a session edit (`.env`/key guards). Every commit is typechecked, lint-clean, formatted, and conventionally messaged. Claude Code can't skip any of it (`--no-verify` block). Stop-time review covers security, not just style.

**Bad**: sequential pre-commit is slower than the old parallel two-job setup (~3s cold, turbo-cached after). Gitleaks bootstrap assumes Homebrew on macOS, so other platforms fail with a clear message until phase 2 pins binaries in CI. Two Opus reviewers make every stop slower and costlier.
