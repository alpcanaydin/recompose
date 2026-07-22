# CI Layer — Design

Date: 2026-07-22
Status: Approved

## Context

Phase 2 of the quality-gate work (deferred in `2026-07-21-local-quality-gates-design.md`) is unblocked: the GitHub remote exists (`alpcanaydin/recompose`, single maintainer). Repo state: one workspace (`apps/desktop`), turbo tasks `lint typecheck build test`, no test files yet, no `.github` directory.

Scope was trimmed to what produces value today (YAGNI). Deferred with reasons below.

## Decisions

- Workflow shape: **single `ci.yml` with an aggregate-success job** — branch protection requires only `ci-success`; adding a job never touches the ruleset.
- Branch protection as code: **ruleset JSON in repo, applied via `gh api`** — versioned, re-appliable, no extra toolchain.
- Dependency updates: **Renovate GitHub App (hosted)** — only `renovate.json` lives in the repo; zero maintenance, no CI minutes.

## 1. `.github/workflows/ci.yml`

Triggers: `pull_request`, `push` to `main`. Concurrency group cancels superseded runs per ref.

| Job             | What                                                                                                                   | Condition                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `changes`       | `dorny/paths-filter`: classify diff into `code` and `workflows`                                                        | always                         |
| `check`         | pnpm install (store cached via `actions/cache`) → `oxfmt --check` → `turbo run lint typecheck build test`              | `changes.outputs.code == true` |
| `gitleaks`      | full-history secret scan, `fetch-depth: 0`                                                                             | always                         |
| `audit`         | `pnpm audit --prod --audit-level=high`                                                                                 | `changes.outputs.code == true` |
| `zizmor`        | static analysis of workflow files                                                                                      | `changes.outputs.workflows`    |
| `actionlint`    | workflow syntax/shellcheck lint                                                                                        | `changes.outputs.workflows`    |
| `commitlint-pr` | validate PR title against `commitlint.config.ts` (squash-merge makes the title the commit subject)                     | `pull_request` only            |
| `ci-success`    | `needs` all of the above, `if: always()`; fails if any result is `failure` or `cancelled`, treats `skipped` as success | always                         |

Runner: `ubuntu-latest` only. No OS matrix until a release pipeline exists.

Action hygiene: all third-party actions pinned to a commit SHA; `permissions: contents: read` at workflow level, escalated per job only where needed.

## 2. Branch protection

`.github/rulesets/main.json` + `scripts/apply-ruleset.sh`: looks up the ruleset by name via `gh api`; updates it if found, creates it otherwise. Idempotent.

Rules for `main`: pull request required before merge, required status check `ci-success`, no force pushes, no deletion, linear history required. Repository admin role gets bypass for emergencies.

## 3. `renovate.json`

Extends `config:best-practices`. Additions: `minimumReleaseAge: "7 days"` (supply-chain cooldown), automerge for devDependency minor/patch when CI is green, `lockFileMaintenance` weekly. The Renovate GitHub App must be installed on the repo by the maintainer (manual, one-time).

## Verification

- `actionlint` and `zizmor` run locally against the new workflow before the first push.
- Open a real PR that violates each gate once: a fake secret (gitleaks), a bad PR title (commitlint-pr), a lint error (check) — each must turn `ci-success` red.
- A docs-only PR must skip `check`/`audit` and still turn `ci-success` green.
- Apply the ruleset, then verify a direct push to `main` is rejected.

## Out of scope, with reasons

- **CODEOWNERS**: single maintainer; no review routing to encode.
- **trivy**: no containers or published images to scan.
- **semgrep**: the local Opus security Stop reviewer covers Electron/IPC/secret patterns; revisit if that ever moves off.
- **Coverage/mutation thresholds**: zero test files today; add when the test suite exists.
- **Release pipeline + OS matrix**: no releases yet.
- **Merge queue / reusable workflows**: single maintainer, low PR volume.
