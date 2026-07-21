# ADR-0006: Local Quality Gate Layer

**Status**: Accepted
**Date**: 2026-07-21

## Context

A gate inventory of three internal reference repos (an API service, a web app, and an infra monorepo) surfaced ~40 quality/safety gates across six firing stages: agent edit-time, agent stop-time, commit, CI, post-merge, and platform config. recompose has no remote repo yet, so only the local stages can run and be verified today. Design spec: `docs/superpowers/specs/2026-07-21-local-quality-gates-design.md`.

## Decision

Adopt the local layer now; defer CI, branch protection, and Renovate to when the GitHub remote exists.

- **Stop hook**: two independent Opus reviewers — rules compliance and security (Electron posture, IPC surface, provider-key discipline, committed secrets). Each keeps its own review marker (`.git/claude-reviewed`, `.git/claude-security-reviewed`); a shared marker would drop one reviewer's diff whenever the other passes and advances it.
- **lefthook pre-commit**, sequential with `priority` + `stage_fixed`: gitleaks staged secret scan (self-bootstraps via `brew install gitleaks` on a fresh clone, fails loudly if still missing) → `oxlint --fix --deny-warnings` → `oxfmt` (fix-and-restage instead of `--check`) → `pnpm run typecheck`.
- **commit-msg**: `commitlint` with `@commitlint/config-conventional`, `type-enum` restricted to the 11 caveman-commit types. The package was chosen over an inline regex so phase 2 CI reuses the same config for the PR-title gate.
- **PreToolUse guards**: edits to `.env*` (except `.env.example`) and key material (`*.pem`, `*.key`, `*.p12`, `id_rsa*`, `id_ed25519*`) are denied; Bash commands containing `--no-verify`/`--no-gpg-sign` are blocked so the agent cannot bypass the commit gates.

A fresh clone needs nothing beyond `pnpm install`: every gate except gitleaks is an npm devDependency, and the gitleaks job installs itself.

## Alternatives

- **Inline POSIX regex for commit messages**: zero deps, but the gate would be rewritten as commitlint anyway when CI needs PR-title validation.
- **One combined Stop reviewer**: cheaper per stop, but security findings drown in style findings and one prompt serves two masters; the split proved cleaner in the reference repos.
- **Gate fixture test suite**: skipped — the hooks are one-liners; each was pipe-tested and proven with an injected violation instead.

## Consequences

**Good**: secrets cannot reach a commit (gitleaks) or an agent edit (`.env`/key guards); every commit is typechecked, lint-clean, formatted, and conventionally messaged; the agent cannot skip any of it (`--no-verify` block); stop-time review covers security, not just style.

**Bad**: sequential pre-commit is slower than the old parallel two-job setup (~3s cold, turbo-cached after); gitleaks bootstrap assumes Homebrew on macOS — other platforms fail with a clear message until phase 2 pins binaries in CI; two Opus reviewers make every stop slower and costlier.
