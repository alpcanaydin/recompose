# 0023: Type-level tests for load-bearing derived types

**Status**: Accepted
**Date**: 2026-07-24

## Context

The contracts package's exported types are mostly derived, inferred from zod schemas or mapped from the channel table (`IpcRequest`, `IpcResponse`, `RecomposeIpc`). Runtime specs prove what parses. Nothing proved what the _types_ promise. A refactor can widen `IpcError['code']` to `string` without anyone noticing, or leak a `secret` key into a response type, and every consumer still compiles. That would erode the guarantee the whole typed Inter-Process Communication (IPC) design leans on, with no failing signal to catch it. The control-gates queue orders type-level tests fourth.

## Decision

- **`*.test-d.ts` specs with `expectTypeOf`, executed by vitest's typecheck runner** (`test.typecheck.enabled` in the contracts config). The specs pin: read channels take `void`, write channels take exactly their domain payload, every response is the closed result envelope, `IpcError['code']` stays the closed four-code set, account rows crossing the bridge are structurally secret-free, `RecomposeIpc` covers every channel and nothing else, and `Migration` transforms raw document shapes.
- **Two independent enforcement legs, no new wiring.** Vitest runs the type specs inside the existing `test` task (CI `check` job, transitively required); `tsc --noEmit` type-errors on the same files through the lefthook `typecheck` job, because the package tsconfig includes all `src/**/*`. Gates that already exist satisfy the standing rule's pre-commit + CI + required chain.
- **Type specs follow the Test-Driven Development (TDD) invariant at the type level** (recorded in CLAUDE.md): a type contract changes if and only if its type spec changes. An assertion written wrong on purpose failed both the vitest typecheck run and raw tsc, proving red came before green.
- **Coverage ignores `*.test-d.ts`**: the files never execute; instrumenting them would report phantom uncovered lines.

## Alternatives

- **tsd / expect-type as a separate runner**: a second test harness and dependency for what vitest already ships built-in. Rejected.
- **Relying on `tsc --noEmit` alone**: catches breakage but buries type assertions in ordinary source, with no test naming, no reporting, and no behavioral grouping. The vitest runner gives type specs the same Given/When/Then legibility as runtime specs.

## Consequences

- Widening an error code union, changing a channel's payload, or leaking secret material into a response type now fails tests and pre-commit typecheck with a named spec, not a downstream consumer surprise.
- `expectTypeOf().toEqualTypeOf` is strict about exact type identity; intentional contract changes must touch the spec in the same PR, which is the audit trail working as designed.
- The gate covers `packages/contracts` today. New load-bearing derived types elsewhere (the engine's routing types, for instance) must bring their own `*.test-d.ts` per the CLAUDE.md rule.
