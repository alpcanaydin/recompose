# CI layer: Design

Date: 2026-07-22
Status: Approved

## Context

The GitHub remote now exists (`alpcanaydin/recompose`, single maintainer), unblocking phase 2 of the quality-gate work (deferred in `2026-07-21-local-quality-gates-design.md`). Repo state: one workspace (`apps/desktop`), turbo tasks `lint typecheck build test`, no test files yet, no `.github` directory.

This design trims scope to what produces value today, per You Aren't Gonna Need It (YAGNI). The reasons for each deferral appear below.

## Decisions

- Workflow shape: **single `ci.yml` with an aggregate-success job**. Branch protection requires only `ci-success`, so adding a job never touches the ruleset.
- Branch protection as code: **ruleset JSON in repo, applied via `gh api`**, versioned and re-appliable, with no extra toolchain.
- Dependency updates: **Renovate GitHub App (hosted)**, since only `renovate.json` lives in the repo, with zero maintenance and no CI minutes.

## 1. `.github/workflows/ci.yml`

Triggers: `pull_request`, `push` to `main`. Concurrency group cancels superseded runs per ref.

| Job             | What                                                                                                                      | Condition                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `changes`       | `dorny/paths-filter`: classify diff into `code` and `workflows`                                                           | always                         |
| `check`         | pnpm install (store cached via `actions/cache`) → `oxfmt --check` → `turbo run lint typecheck build test`                 | `changes.outputs.code == true` |
| `gitleaks`      | full-history secret scan, `fetch-depth: 0`                                                                                | always                         |
| `audit`         | `pnpm audit --prod --audit-level=high`                                                                                    | `changes.outputs.code == true` |
| `zizmor`        | static analysis of workflow files                                                                                         | `changes.outputs.workflows`    |
| `actionlint`    | workflow syntax/shellcheck lint                                                                                           | `changes.outputs.workflows`    |
| `commitlint-pr` | validate PR title using `commitlint.config.ts` (squash-merge makes the title the commit subject)                          | `pull_request` only            |
| `ci-success`    | `needs` every prior job, `if: always()`, fails if any result is `failure` or `cancelled`, and treats `skipped` as success | always                         |

Runner: `ubuntu-latest` only. No OS matrix until a release pipeline exists.

Action hygiene: all third-party actions pin to a commit Secure Hash Algorithm (SHA) value. `permissions: contents: read` applies at the workflow level, escalated per job only where needed.

## 2. Branch protection

`.github/rulesets/main.json` + `scripts/apply-ruleset.sh`: looks up the ruleset by name via `gh api`, updates it if found, and creates it otherwise. Idempotent.

Rules for `main`: pull request required before merge, required status check `ci-success`, no force pushes, no deletion, linear history required. Repository admin role gets bypass for emergencies.

## 3. `renovate.json`

Extends `config:best-practices`. Additions: `minimumReleaseAge: "7 days"` (supply chain cooldown), automerge for devDependency minor/patch when CI is green, `lockFileMaintenance` weekly. The maintainer must install the Renovate GitHub App on the repo (manual, one-time).

## Verification

- `actionlint` and `zizmor` run locally on the new workflow before the first push.
- Open a real PR that violates each gate once: a fake secret (gitleaks), a bad PR title (commitlint-pr), a lint error (check). Each must turn `ci-success` red.
- A docs-only PR must skip `check`/`audit` and still turn `ci-success` green.
- Apply the ruleset, then verify it rejects a direct push to `main`.

## Out of scope, with reasons

- **CODEOWNERS**: single maintainer; no review routing to encode.
- **trivy**: no containers or published images to scan.
- **semgrep**: the local Opus security Stop reviewer covers Electron, Inter-Process Communication (IPC), and secret patterns. Revisit if that ever moves off.
- **Coverage/mutation thresholds**: zero test files today; add when the test suite exists.
- **Release pipeline + OS matrix**: no releases yet.
- **Merge queue / reusable workflows**: single maintainer, low PR volume.
