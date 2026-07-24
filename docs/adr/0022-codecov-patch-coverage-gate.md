# 0022: Patch coverage gate via Codecov

**Status**: Accepted
**Date**: 2026-07-23

## Context

The project coverage gate (90% thresholds, ratcheting per Architecture Decision Record (ADR) 0015) judges the whole tree. So a PR can add lines with weak coverage while global numbers stay green. This dilution hides regressions at the margin. The control-gates queue orders a diff-scoped gate third: changed lines in a PR must meet a high threshold while the project gate stays untouched. The queue originally demanded a self-contained tool. The maintainer relaxed that requirement to allow free SaaS, changing the answer.

## Decision

- **Codecov, free for public repositories, uploads via `codecov/codecov-action` v7 with OpenID Connect (OIDC)** (`use_oidc: true`), needing no token secret to manage; fork PRs upload tokenless on public repos.
- **OIDC lives in a dedicated `coverage-upload` job.** `id-token: write` never coexists with third-party code execution: the `check` job (pnpm postinstall scripts, playwright, the whole test suite) keeps `contents: read` only and hands `lcov.info` files over as artifacts; the upload job holds the OIDC grant and runs nothing but checkout, artifact download, and the pinned Codecov action. A compromised dependency in `check` therefore can't mint an OIDC token. The split doesn't authenticate report contents: the artifact stays only as trustworthy as the job that produced it.
- **`codecov/patch` at target 100%**: every changed line that appears in the coverage report needs test coverage. Lines in the boundary files ADR-0012 already exempts from coverage collection (main-process wiring, preload, generated route trees) never enter the report, so the gate doesn't punish uncoverable wiring. Day-one green holds trivially: the gate judges future diffs.
- **`codecov/project` status is off.** The vitest 90% ratchet remains the single authority for project-level coverage; a second project gate with its own comparison semantics would be a dual source of truth.
- **Rollout order**: the upload step lands first; `codecov/patch` joins the ruleset's required checks only once the Codecov GitHub App is in place and the first upload proves the status context appears. Making it required first would brick every PR.
- **Standing-rule deviation, recorded explicitly**: this gate has no lefthook pre-commit leg. Patch coverage is a base-comparison computed against the upstream branch from freshly generated reports; a local reimplementation (diff-cover and friends) would be a second implementation of the same rule that can disagree with the authoritative one. Local feedback stays immediate through the vitest thresholds every test run enforces.

## Alternatives

- **diff-cover (pipx)**: the long-standing local tool; probed empirically and hit the monorepo wall: vitest writes package-relative `SF:` paths while git diffs are repo-root-relative, so it reports "No lines with coverage information" without path-rewriting glue. Workable with sed plumbing, but that glue plus per-package invocation is exactly the machinery Codecov makes unnecessary.
- **covguard / cover-diff**: diff-scoped npm-ecosystem tools, but neither appears on npm; GitHub-only installs fail the supply chain bar (pinned, registry-quarantined dependencies per ADR-0015).
- **Custom lcov+diff script**: ~100 lines plus its own tests and maintenance, rejected while a purpose-built free service exists.

## Consequences

- PRs gain a `codecov/patch` status and a condensed diff-coverage comment; an uncovered changed line fails the check once it becomes required.
- The repository takes its second free-SaaS dependency (after the Vercel remote cache), again contained: removing the upload step and the ruleset context reverts fully.
- Coverage reports leave the repository for Codecov's service, acceptable for a public codebase.
- The 100% patch target will occasionally force a test for a line the author considered trivial; that pressure is the point, and a genuine exemption must argue its case as a visible `codecov.yml` change in the PR diff.
