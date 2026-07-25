# Stryker mutation testing design

Date: 2026-07-26
Status: Approved

## Context

The maintainer pulled this job forward from the engine rider after the infrastructure queue closed. The coverage gates prove lines run. They don't prove tests bite. Mutation testing supplies those teeth: StrykerJS mutates the source and counts how many mutants the suite kills. The repo's test landscape splits cleanly. The node-side suites are fast and rich: `packages/contracts` finishes in under two seconds, and the desktop `unit` project covers the main process (vault, stores, migrations, protocol resolvers) in under one second. The renderer runs in Vitest browser mode and Storybook, which Stryker's vitest runner doesn't support. The original rider fixed two constraints in advance: diff-scoped runs per pull request plus a scheduled full run, and the full run never sits in the delivery pipeline. The maintainer resolved the blocking question during this brainstorm: the diff-scoped pull request run blocks, the scheduled full run informs.

## Decisions

- **Mutation covers the node-tested surfaces only.** The mutate scope is `packages/contracts/src` and `apps/desktop/src/main`, minus test files and the entry points the coverage config already excludes. The renderer stays out because the vitest runner doesn't support browser mode; the Architecture Decision Record (ADR) records that boundary and its revisit trigger, runner support arriving.
- **Two Stryker configs, one per package.** Each binds to its package's own Vitest config with `coverageAnalysis: perTest`, the biggest performance lever Stryker offers. Exact-pinned devDependencies: `@stryker-mutator/core` and `@stryker-mutator/vitest-runner`.
- **The pull request gate blocks.** A `mutation` job in the `ci` workflow filters changed files against the mutate scope, skips cleanly when the diff touches none, and otherwise runs Stryker in incremental mode over the changed files. `thresholds.break` fails the job below the floor; the first floor comes from a measured full run so the gate is green on day one and ratchets later, the ADR-0015 discipline. The job joins the `ci-success` needs list.
- **The incremental baseline travels as a cache artifact, never as source.** Stryker's own guidance: the `stryker-incremental.json` file changes constantly and belongs in CI caching, not in the repository. Pull request runs restore it; the weekly full run refreshes it.
- **A weekly full run informs and never blocks.** A `mutation-full.yml` workflow on an off-peak weekly cron runs the entire mutate scope, uploads the HTML report as an artifact, refreshes the incremental baseline, and reports the score to the Stryker dashboard. The rider's never-in-the-delivery-pipeline clause lives here.
- **The Stryker dashboard tracks the trend.** The full run sends its report to `dashboard.stryker-mutator.io` with the dashboard reporter; pull request runs don't, because partial scores would pollute the trend line. The maintainer enables the repository on the dashboard and stores the API key as the `STRYKER_DASHBOARD_API_KEY` secret.
- **No lefthook leg.** Mutation runtime is unpredictable at commit time; the Chromatic precedent's "where applicable" clause covers the exemption, recorded in the ADR.
- **ADR-0036 records the decisions** through the architecture-decision-records skill.

## Maintainer prerequisites

- Sign in at `dashboard.stryker-mutator.io` with GitHub, enable `recomposesh/recompose`, and store the API key: `gh secret set STRYKER_DASHBOARD_API_KEY --repo recomposesh/recompose`.

## Testing

- A measured local full run over both packages sets the day-one `break` floor and lands in the ADR as evidence.
- The pull request proves the gate's skip path if its diff stays outside the mutate scope; a scoped sanity run against one changed file proves the diff path before merge.
- The first scheduled run proves the artifact refresh and the dashboard report; the ADR records the follow-up check.

## Out of scope

- Renderer and Storybook mutation: blocked on runner support, recorded as the revisit trigger.
- The engine package: it doesn't exist yet; its spec inherits this gate when it lands.
- Mutation-score badges and README decoration.

## Risks

- Diff-scoped runs can still turn slow when a pull request touches a hot module with many mutants; the incremental cache bounds the pain, and the ADR records widening the skip filter as the pressure valve.
- Incremental mode misses environment-level changes (dependency bumps, config shifts) by design; the weekly full run is the corrective, resetting the baseline from zero context.
- A too-eager `break` floor blocks unrelated work; the day-one-green measurement plus ratcheting keeps the floor honest.

## Decision record

ADR-0036 lands with the implementation through the architecture-decision-records skill. It captures the node-only scope with its runner-support boundary, the blocking split between pull request and scheduled runs, and the measured floor with the ratchet rule. The incremental-artifact policy and the dashboard choice close the record.
