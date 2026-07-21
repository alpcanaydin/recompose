# TDD/BDD Rules — inside-out (Detroit/classicist), BDD-style specs

## Method
- Test-first, always: red → green → refactor. No implementation code before a failing test.
- Work **inside-out**: start from the core domain (engine, routing, protocol translation) and grow outward toward APIs/UI. Design emerges from the tests.
- One behavior per test. A "unit" is a **behavior**, not a class or a file.

## Verification style
- **State-based, not interaction-based.** Assert on outcomes and returned/observable state.
- No mocks for internal collaborators — exercise them indirectly through the unit under test.
- Test doubles only at real process boundaries: network, filesystem, clock, child processes.

## BDD spec language
- Tests are behavior specs: structure and name them Given/When/Then (arrange/act/assert).
- Describe *what* the system does in domain language ("failover shifts traffic to the next healthy target"), never *how* ("calls selectTarget() twice").
- A scenario must make sense to someone who has never seen the implementation.

## The invariant
- **Test code changes if and only if behavior changes.**
- A pure refactor must never require touching a test. If it does, the test was coupled to implementation — rewrite the test against public behavior, don't patch it.
- Forbidden in tests: reaching into private state, asserting call order/counts of internals, importing non-public modules.
