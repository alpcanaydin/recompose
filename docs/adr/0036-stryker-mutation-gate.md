# 0036: Stryker mutation gate over the node-tested surfaces

**Status**: Accepted
**Date**: 2026-07-26

## Context

The coverage gates prove lines run. They don't prove tests bite: a suite full of weak assertions can hold 100 percent patch coverage while catching nothing. Mutation testing supplies the teeth. StrykerJS mutates the source and counts how many mutants the tests kill. The maintainer pulled this gate forward from the engine rider after the infrastructure queue closed. It keeps the rider's two constraints: diff-scoped runs per pull request and a scheduled full run. The full run never sits in the delivery pipeline. The maintainer resolved the open half during the brainstorm: the pull request run blocks, the scheduled run informs.

## Decision

- **Mutation covers the node-tested surfaces only.** The mutate scope is `packages/contracts/src` and `apps/desktop/src/main`, minus tests and minus the exact entry points the coverage config already excludes. The renderer stays out: Stryker's vitest runner doesn't support browser mode, and that support arriving is the recorded revisit trigger.
- **Each package carries a dedicated mutation Vitest config.** No typecheck, no coverage, single project: mutants need the fastest honest kill loop, and the desktop config flattens the `unit` project so the browser and Storybook projects never load. `coverageAnalysis: perTest` keeps each mutant's test set minimal.
- **The pull request gate blocks.** The `mutation` job diffs the pull request against its base, skips cleanly when nothing in the mutate scope changed, and otherwise runs Stryker incrementally over the changed files. `thresholds.break` fails the job below the floor, and the job sits in the `ci-success` needs list.
- **The floors come from measured runs, not guesses.** The first full runs scored 82.01 percent for contracts and 86.89 percent for the desktop main process. The break floors sit five points under each, following the ratchet discipline from Architecture Decision Record (ADR) 0015. Raising a floor is cheap and encouraged; lowering one needs a recorded reason here.
- **The incremental baseline is a cache artifact, never source.** Stryker's own guidance: `stryker-incremental.json` churns constantly and belongs in CI caching. Pull requests restore the newest baseline; the weekly run saves a fresh one.
- **A weekly full run informs and never blocks.** `mutation-full.yml` runs both packages on a Monday-morning cron, uploads the HTML report as an artifact, refreshes the baseline, and reports to the Stryker dashboard at `dashboard.stryker-mutator.io` under `github.com/recomposesh/recompose`, modules `contracts` and `desktop-main`. Pull request runs never report to the dashboard, because partial scores would pollute the trend.
- **A CLAUDE.md rule pairs the gate with property tests.** Node-side logic changes must survive the mutation gate, non-trivial invariants pair a property-based test with it, and a surviving mutant dies through a better test, never through a weakened threshold.
- **No lefthook leg.** Mutation runtime is unpredictable at commit time; the where-applicable clause from the Chromatic record covers the exemption.

## Alternatives

- **Mutating the renderer through browser mode**: rejected until the vitest runner supports it; the official docs still list browser mode as unsupported.
- **One root Stryker config**: rejected. Two packages with separate Vitest roots each get a config bound to their own test world; a root config would blur `perTest` coverage and module-level dashboard reporting.
- **Advisory-only mutation scores**: rejected by the maintainer's ruling; the repo bans advisory gates, and the pull request run carries the teeth.
- **Committing the incremental file**: rejected on Stryker's own guidance; it's an artifact, not source.

## Consequences

**Good**: a weak test dies in review instead of surviving into the suite. The gate scales with the diff, so small pull requests pay seconds, not minutes. The dashboard shows the trend per module, and the weekly run keeps the baseline honest against environment drift that incremental mode can't see.

**Bad, and accepted**: a pull request touching a hot module pays a real mutation bill even diff-scoped. Widening the skip filter is the recorded pressure valve. Incremental mode misses dependency and environment changes by design. The weekly full run is the corrective. The engine package inherits this gate on arrival and will re-measure its own floor. Two of the toolchain workarounds lean on undocumented behavior: the ignored missing tsconfig file and the type-hidden `oxc.tsconfig` switch. A Stryker or Vite upgrade may resurface the friction. Both live as watch items here.
