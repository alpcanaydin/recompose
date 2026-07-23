# ADR-0024: Full Type-Aware Lint, Config-Driven

**Status**: Accepted
**Date**: 2026-07-24

## Context

`strict: true` and the cast/`any` lint bans stop what we write, but `any` still flows in through inference: an untyped third-party return (`Object.getPrototypeOf`, `JSON.parse`) silently untypes every identifier downstream, and no existing gate saw it. Worse, the audit for this gate found `.oxlintrc.json` already declared the whole `typescript/no-unsafe-*` family as errors — dormant, because every oxlint invocation ran without `--type-aware`, and oxlint silently skips rules that need type information. The queue's fifth gate (a type-coverage ratchet) turned into something better: activate the rules the config already promised.

## Decision

- **Type-aware mode is on by default via the root config** — `options.typeAware: true` in `.oxlintrc.json` — so every plain `oxlint` invocation (package scripts, root scripts, lefthook, editors) gets it with no per-site flags. The engine is `oxlint-tsgolint` (exact-pinned), oxc's typescript-go-backed checker — the full tree lints type-aware in under two seconds.
- **Every implemented tsgolint rule is enabled as an error** — the audit found the config already declared 54 of them, all dormant; the missing ones were added so the full set (unsafe family, `strict-boolean-expressions`, `strict-void-return`, `no-floating-promises`, `no-misused-promises`, `switch-exhaustiveness-check`, and the rest) now actually runs. Proven live by probe: a `JSON.parse` chain fails with three errors. `typescript/no-non-null-assertion` joins them.
- **Recorded exclusions**: `prefer-readonly-parameter-types` is off — typescript-eslint keeps it out of its own strict preset because deep-readonly parameters fight zod-inferred, React, and Electron signatures until only a banned cast satisfies them (68 unactionable hits on this tree). `naming-convention` and `prefer-destructuring` are implemented in tsgolint but absent from oxlint 1.74's rule registry — revisit on upgrade. `options.typeCheck` stays off: compiler errors are already a dedicated `typecheck` task and lefthook job; one authority per failure.
- **One sanctioned any-crossing**: `apps/desktop/src/preload/index.ts` carries a config-level override for `no-unsafe-return` — Electron types `ipcRenderer.invoke` as `Promise<any>`, the preload is deliberately a zod-free dumb pipe (ADR-0018), and both directions are validated in main. The override lives in `.oxlintrc.json` where its diff is reviewable, not in a code comment.
- **Fixes landed to make the tree pass at full strength**: the contracts prototype probe goes through a `: unknown` annotation instead of an `any`-tainted chain; the renderer bootstrap replaced `document.getElementById('root')!` with a null guard; 45 promise-returning test helpers became `async` (autofix); ten void-context callbacks stopped leaking return values; the dev-server URL check handles nullish and empty string explicitly.
- **Zero new wiring**: lint already runs in lefthook and in CI's required chain; this gate is a flag and a rule, not a job.

## Alternatives

- **`type-coverage --strict` ratchet (the queue's original shape)** — evaluated hands-on: it measured 100/100/99.19% across the three compilation units and found the same taint. Rejected as the primary gate: a single-maintainer tool with a yearly release cadence against oxc's active development, a fourth threshold to book-keep, and per-tsconfig invocation plumbing. The use-site `no-unsafe` rules fail the offending expression directly instead of moving a percentage. What type-coverage uniquely adds — flagging types that merely _contain_ `any` without a local use, like the route generator's taint spreading into `router` identifiers — was judged not worth a second tool: those flows error the moment they are actually used unsafely.
- **`typecov` PR comments over Codechecks** — both packages unmaintained since 2022; dead service, no.
- **typescript-eslint beside oxlint** — the rule family's origin, but a second linter for rules oxc already ships.

## Consequences

- An `any` value assigned, passed, called, returned, or member-accessed anywhere in the tree fails pre-commit and CI at the exact expression — this now guards the engine's future provider-SDK boundary, the classic `any` spring.
- Non-null assertions are banned outright; the fix is a guard or a narrowing, which is what the clean-code rules wanted anyway.
- Generated-file taint (the route generator's internal `as any`) stays invisible until an unsafe use materializes — accepted; revisit if oxc ships a containment-style rule or the generator goes cast-free.
- Type-aware lint binds lint speed to typescript-go's checker; today that is ~1.7 s for the whole tree.
