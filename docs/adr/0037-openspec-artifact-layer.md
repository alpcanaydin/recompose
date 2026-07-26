# 0037: OpenSpec artifact layer

**Status**: Accepted
**Date**: 2026-07-26

## Context

The infrastructure queue closed. Every machine gate, the security baseline, Storybook, Playwright, Chromatic, release operations, and the mutation gate now sit on `main`. Those gates judge a pull request after it exists. The process that produces the pull request still ran ad hoc.

The feature-cycle design fixes that. Its "Layer architecture" section splits the pipeline into three layers so no piece of knowledge lives twice. The spec lives at `docs/superpowers/specs/2026-07-26-feature-cycle-design.md`. This Architecture Decision Record (ADR) records the first layer: the artifact lifecycle. The process definition and its workflows land in later pull requests and build on this foundation.

## Decision

recompose adopts OpenSpec as the artifact layer, pinned to exact version 1.6.0.

- **The change directory is the unit of work.** `openspec/specs/` holds the living behavior contract for the whole system. Each feature lives in `openspec/changes/<slug>/` with its proposal, design, tasks, and spec deltas. A merge archives the change into `specs/`, so the spec tree stays the current truth.
- **The `recompose` schema extends each change.** A custom schema adds `discovery/`, `gherkin/`, and `manifest.md` to the change directory, which the default schema lacks. The schema lives under `openspec/schemas/recompose`.
- **A hand edit sets the active schema.** OpenSpec 1.6.0 `schema init --default` writes a `defaultSchema` key that the Command-Line Interface (CLI) never reads. The authoritative key is `schema:` in `openspec/config.yaml`. A hand edit sets that key to `recompose`.
- **The validate gate runs `openspec validate --all --strict --no-interactive`.** Both the plain form and the strict form return exit 0 on the empty tree. The plan made strict conditional on that proof, so the gate adopts strict.
- **The prose gate exempts machine-written output and lints every human document.** Three globs join the exclusion list, one per gate, following the pattern ADR-0030 set for plans. `**/.claude/commands/**` covers the generated CLI command files, the same class as vendored skills, which `openspec update` regenerates. `**/openspec/schemas/**` covers the CLI scaffold templates, which fail Vale by design. `**/openspec/changes/**/discovery/**` covers the machine-written discovery output. That last glob matches a `discovery` segment at any depth under `changes/`. The `openspec/specs/**` tree and the human documents (`proposal.md` and `design.md`) stay under the full prose gate.
- **The generated `opsx` skills stay out of `skills-lock.json`.** The npm install generates them, and the openspec dependency owns them. `openspec update` regenerates them. That differs from the github-vendored skills, which the lock file tracks.
- **The `docs/superpowers/` trees freeze as history.** The existing specs and plans stay as a record. No new document lands there. New feature artifacts live in `openspec/changes/<slug>/`.
- **Telemetry stays off through the environment.** OpenSpec bundles PostHog. The opt-out is environment-only through `OPENSPEC_TELEMETRY=0` or `DO_NOT_TRACK=1`. Continuous Integration (CI) disables it on its own. No project-level config key exists. This gap sits against the offline-first stance of the repo, so the environment variables carry the policy.

## Alternatives

- **Keep dated design documents under `docs/superpowers/`**: rejected. That approach turns spec reading into archaeology and grows the drift-audit surface. The `specs/` tree replaces it with one current truth.
- **A hand-rolled artifact format**: rejected. OpenSpec models proposals, deltas, archive-on-merge, and validation. Rebuilding it adds cost with no gain.
- **The default OpenSpec schema**: rejected. It lacks the `discovery/`, `gherkin/`, and `manifest.md` artifacts the feature cycle needs.
- **OpenSpec's generated Gherkin**: rejected. The maintainer found the generated scenarios below the project bar. A dedicated node writes them in-house, and OpenSpec stores the result and nothing more.
- **The `defaultSchema` config key**: rejected. The 1.6.0 CLI never reads it. The `schema:` key is the one the CLI honors.
- **A project-level telemetry switch**: unavailable. OpenSpec exposes no config key for it, so the environment variables and the CI default carry the opt-out.

## Consequences

**Good**: each feature gets its own change directory, so parallel features never collide on shared spec files. Archive-on-merge keeps `openspec/specs/` current, which shrinks the drift-audit surface the old design-doc trees grew. The feature-cycle skill in the next pull request builds on this schema instead of inventing its own storage. One current-truth spec tree replaces dated design-doc archaeology.

**Bad, and accepted**: OpenSpec moves fast, so churn is the price. The pin is exact. Updates flow through Renovate under the repo minimum-release-age policy (the pnpm `minimumReleaseAge` setting, ADR-0015 item 4). That policy buys a soak window before any bump lands. The dead `defaultSchema` key is a hand-correction that a re-init could reintroduce, so it stays a watch item. Telemetry has no project-level off switch. That leans on the environment variables and the CI default, a gap against the offline-first stance. The schema templates skip the prose gate, so a typo there escapes Vale. The exemption globs repeat once per gate, and nothing machine-checks that pairing, the same trade-off ADR-0030 accepted.
