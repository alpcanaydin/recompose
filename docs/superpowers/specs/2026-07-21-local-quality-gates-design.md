# Local quality gates: Design

Date: 2026-07-21
Status: Approved

## Context

Gate inventories of three internal reference repos (an API service, a web app, and an infra monorepo) surfaced ~40 distinct quality/safety gates across six firing stages. recompose adopts the local layer now (no remote repo yet) and defers CI, branch protection, and Renovate to a phase 2, once the GitHub remote exists.

recompose already has pnpm-lock edit protection (PreToolUse), oxfmt+oxlint on edit (PostToolUse, blocking), and one Opus rules-compliance Stop reviewer with a `.git/claude-reviewed` marker. It also runs lefthook pre-commit (oxlint + oxfmt --check), a maximally strict tsconfig, and the `rules-reviewer` subagent.

## Scope

Local layer only, four pieces:

### 1. Stop hook: Second Opus security reviewer

A second `type: "agent"` entry sits alongside the existing rules reviewer (web pattern). It reviews the same diff scope (uncommitted work plus commits since its marker) but keeps its **own marker**, `.git/claude-security-reviewed`. A shared marker would lose one reviewer's diff whenever the other passes and advances it.

Review scope (blocking findings only):

- Electron security posture: enabling `nodeIntegration`, disabling `contextIsolation` or `sandbox`, `webSecurity: false`, loosening Content Security Policy (CSP), `shell.openExternal` with unvalidated input.
- Inter-Process Communication (IPC) surface: handlers that trust renderer input without validation, and exposing broad primitives (`ipcRenderer.send` passthrough) via the preload bridge.
- Secret discipline: provider API keys never logged, never committed, never stored outside Electron `safeStorage`. Keys must not leak into error messages, telemetry, or renderer-visible state.
- Committed secrets of any kind.

It doesn't report style, naming, or architecture, since the rules reviewer owns those. Same contract: `{"ok": false, "reason": ...}` blocks the stop, and on pass it advances its marker.

### 2. lefthook: Full pre-commit + commit-msg

Replace `parallel: true` with the sequential priority + `stage_fixed` pattern (api):

| Job                   | Command                                       | Behavior                                                                                                                                            |
| --------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| gitleaks (priority 0) | `gitleaks git --staged --redact --no-banner`  | Secret scan of staged diff. Self-bootstraps on a fresh clone (`brew install gitleaks` if missing). Still missing → commit fails with a clear error. |
| lint (priority 1)     | `oxlint --fix --deny-warnings {staged_files}` | Autofix, re-stage (`stage_fixed: true`), fail on surviving warnings.                                                                                |
| fmt (priority 2)      | `oxfmt {staged_files}`                        | Format and re-stage (`stage_fixed: true`), replacing `--check`.                                                                                     |
| typecheck             | `pnpm run typecheck`                          | Whole-repo via turbo (cached).                                                                                                                      |

commit-msg: `commitlint --edit {1}` with `commitlint.config.ts` extending `@commitlint/config-conventional`, `type-enum` restricted to the 11 caveman-commit types (`feat fix refactor perf docs test chore build ci style revert`). devDeps: `@commitlint/cli`, `@commitlint/config-conventional`. Chosen over an inline regex because phase 2 reuses the same config for the CI PR-title gate.

### 3. PreToolUse guards (settings.json)

- File guard (existing pnpm-lock case gains lines): deny edits to `.env*` (except `.env.example`) and key material (`*.pem`, `*.key`, `*.p12`, `id_*`), each with a remediation message.
- New Bash guard: block any command containing `--no-verify` or `--no-gpg-sign` (exit 2), which serves as the bypass insurance for the commit gates described earlier.

### 4. Verification + record

- Pipe-test every hook with a synthetic stdin payload.
- `lefthook run pre-commit --all-files` end-to-end.
- Inject one deliberate violation per gate (fake API key, bad commit message, `--no-verify` commit) and prove the gate blocks.
- Record the decision in an Architecture Decision Record (ADR), numbered ADR-0006 (local quality gate layer: stages, why commitlint-the-package, why two Stop reviewers with separate markers).

## Out of scope (phase 2, when the remote exists)

Phase 2 covers CI workflows (aggregate-success + paths-filter pattern, security scanners: gitleaks full-history, audit, zizmor, actionlint, semgrep, trivy) and branch protection as code. It also covers CODEOWNERS, Renovate with `minimumReleaseAge`, coverage/mutation thresholds, and a gate fixture test suite.

## Also decided in this session

CLAUDE.md rule added: before any UI/UX design decision, search the Mobbin Model Context Protocol (MCP) server for similar-concept designs.
