# 0024: Full type-aware lint, config-driven

**Status**: Accepted
**Date**: 2026-07-24

## Context

`strict: true` and the cast/`any` lint bans stop direct `any` in source code. `any` still flows in through inference, though. An untyped third-party return (`Object.getPrototypeOf`, `JSON.parse`) untypes every identifier downstream without a trace, and no existing gate saw it. Worse, the audit for this gate found `.oxlintrc.json` already declared the whole `typescript/no-unsafe-*` family as errors, dormant because every oxlint invocation ran without `--type-aware`. oxlint skips rules that need type information and never warns about it. The queue's fifth gate (a type-coverage ratchet) turned into something better: activate the rules the config already promised.

## Decision

- **Type-aware mode is on by default via the root config**: `options.typeAware: true` in `.oxlintrc.json` sets it, so every plain `oxlint` invocation (package scripts, root scripts, lefthook, editors) gets it with no per-site flags. The engine is `oxlint-tsgolint` (exact-pinned), oxc's typescript-go-backed checker, and the full tree lints type-aware in under two seconds.
- **The config enables every implemented tsgolint rule that oxlint's registry knows as an error, save the recorded exclusions below**: the audit found the config already declared 54 of them, all dormant; this decision adds the missing ones so the full set (unsafe family, `strict-boolean-expressions`, `strict-void-return`, `no-floating-promises`, `no-misused-promises`, `switch-exhaustiveness-check`, and the rest) now actually runs. Proven live by probe: a `JSON.parse` chain fails with three errors. `typescript/no-non-null-assertion` joins them.
- **Recorded exclusions**: `prefer-readonly-parameter-types` is off. typescript-eslint keeps it out of its own strict preset because deep-readonly parameters fight zod-inferred, React, and Electron signatures until only a banned cast satisfies them (68 unactionable hits on this tree). tsgolint implements `naming-convention` and `prefer-destructuring`, but oxlint 1.74's rule registry lacks them; revisit on upgrade. `options.typeCheck` stays off: compiler errors are already a dedicated `typecheck` task and lefthook job; one authority per failure.
- **One sanctioned any-crossing**: `apps/desktop/src/preload/index.ts` carries a config-level override for `no-unsafe-return`. Electron types `ipcRenderer.invoke` as `Promise<any>`, the preload is a zod-free pass-through by design (Architecture Decision Record (ADR) 0018), and main validates both directions. The override lives in `.oxlintrc.json` where its diff is reviewable, not in a code comment.
- **Fixes landed to make the tree pass at full strength**: the contracts prototype probe goes through a `: unknown` annotation instead of an `any`-tainted chain; the renderer bootstrap replaced `document.getElementById('root')!` with a null guard; 45 promise-returning test helpers became `async` (autofix); ten void-context callbacks stopped leaking return values; the dev-server URL check handles nullish and empty string explicitly.
- **Zero new wiring**: lint already runs in lefthook and in CI's required chain; this gate is a flag and a rule, not a job.

## Alternatives

- **`type-coverage --strict` ratchet (the queue's original shape)**: evaluated hands-on, it measured 100/100/99.19% across the three compilation units and found the same taint. Rejected as the primary gate: a single-maintainer tool with a yearly release cadence against oxc's active development, a fourth threshold to book-keep, and per-tsconfig invocation plumbing. The use-site `no-unsafe` rules fail the offending expression directly instead of moving a percentage. What type-coverage uniquely adds, flagging types that merely _contain_ `any` without a local use, like the route generator's taint spreading into `router` identifiers, doesn't justify a second tool: those flows error the moment they're actually used unsafely.
- **`typecov` PR comments over Codechecks**: both packages unmaintained since 2022; dead service, no.
- **typescript-eslint beside oxlint**: the rule family's origin, but a second linter for rules oxc already ships.

## Consequences

- An `any` value assigned, passed, called, returned, or member-accessed anywhere in the tree fails pre-commit and CI at the exact expression, now guarding the engine's future provider-SDK boundary, the classic `any` spring.
- This gate bans non-null assertions outright; the fix is a guard or a narrowing, which is what the clean-code rules wanted anyway.
- Generated-file taint (the route generator's internal `as any`) stays invisible until an unsafe use materializes. This is an accepted gap; revisit if oxc ships a containment-style rule or the generator goes cast-free.
- Type-aware lint binds lint speed to typescript-go's checker; today that's ~1.7 s for the whole tree.
