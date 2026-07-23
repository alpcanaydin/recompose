# ADR-0023: Type-Level Tests for Load-Bearing Derived Types

**Status**: Accepted
**Date**: 2026-07-24

## Context

The contracts package's exported types are almost all derived — inferred from zod schemas or mapped from the channel table (`IpcRequest`, `IpcResponse`, `RecomposeIpc`). Runtime specs prove what parses; nothing proved what the _types_ promise. A refactor can silently widen `IpcError['code']` to `string` or leak a `secret` key into a response type, and every consumer still compiles — the guarantee the whole typed-IPC design leans on would erode without a failing signal. The control-gates queue orders type-level tests fourth.

## Decision

- **`*.test-d.ts` specs with `expectTypeOf`, executed by vitest's typecheck runner** (`test.typecheck.enabled` in the contracts config). The specs pin: read channels take `void`, write channels take exactly their domain payload, every response is the closed result envelope, `IpcError['code']` stays the closed four-code set, account rows crossing the bridge are structurally secret-free, `RecomposeIpc` covers every channel and nothing else, and `Migration` transforms raw document shapes.
- **Two independent enforcement legs, no new wiring.** Vitest runs the type specs inside the existing `test` task (CI `check` job, transitively required); `tsc --noEmit` type-errors on the same files through the lefthook `typecheck` job, because the package tsconfig includes all of `src/**/*` — the standing rule's pre-commit + CI + required chain is satisfied by gates that already exist.
- **Type specs follow the TDD invariant at the type level** (recorded in CLAUDE.md): a type contract changes if and only if its type spec changes. Red was proven before green — a deliberately wrong assertion failed both the vitest typecheck run and raw tsc.
- **Coverage ignores `*.test-d.ts`** — the files never execute; instrumenting them would report phantom uncovered lines.

## Alternatives

- **tsd / expect-type as a separate runner** — a second test harness and dependency for what vitest already ships built-in. Rejected.
- **Relying on `tsc --noEmit` alone** — catches breakage but buries type assertions in ordinary source, with no test naming, no reporting, and no behavioral grouping. The vitest runner gives type specs the same Given/When/Then legibility as runtime specs.

## Consequences

- Widening an error code union, changing a channel's payload, or leaking secret material into a response type now fails tests and pre-commit typecheck with a named spec, not a downstream consumer surprise.
- `expectTypeOf().toEqualTypeOf` is strict about exact type identity; intentional contract changes must touch the spec in the same PR, which is the audit trail working as designed.
- The gate covers `packages/contracts` today. New load-bearing derived types elsewhere (the engine's routing types, for instance) must bring their own `*.test-d.ts` per the CLAUDE.md rule.
