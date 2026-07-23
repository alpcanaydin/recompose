# ADR-0021: Cyclomatic Complexity Ceiling of 5 via oxlint

**Status**: Accepted
**Date**: 2026-07-23

## Context

The clean-code rules demand small single-responsibility functions, and `max-lines-per-function` (50), `max-depth` (3), and `max-nested-callbacks` (3) already bound size and nesting, and the oxlint hardening pass set a cyclomatic ceiling of 10 — the industry-classic McCabe value, but twice what any function in the tree actually scores. The control-gates queue orders a complexity ceiling second, preferring the existing oxlint over any new tool.

## Decision

- **Tighten eslint core `complexity` (cyclomatic) from 10 to 5** in `.oxlintrc.json`. Probed empirically on oxlint 1.74.0: the rule fires with correct counts and respects the configured maximum.
- **Cognitive complexity is not available in oxlint**: the `sonarjs` plugin does not exist there (`Plugin 'sonarjs' not found`). The queue allows a lighter alternative only when oxlint lacks support — but the only real cognitive-complexity implementation would reintroduce eslint plus `eslint-plugin-sonarjs` beside oxlint, a second linter for one rule. Cyclomatic is supported natively and, combined with the existing depth/nesting/size ceilings, covers most of what cognitive complexity would catch at this codebase's scale. Revisit if oxc ships the sonarjs plugin.
- **Ceiling 5 is today's measured maximum.** Scanning `apps packages` with the ceiling at 1 showed the most complex function in the tree scores exactly 5. The ratchet philosophy (ADR-0015) sets thresholds at the strictest value that is green on day one — that value is 5. The industry-classic McCabe threshold is 10 and eslint's default is 20; both would be dead letters here. Raising the ceiling later is gate-weakening and requires an explicit decision in an ADR, not a config tweak.
- **No new wiring.** oxlint already runs as the lefthook `lint` job and inside `turbo run lint` in CI's `check` job, so the standing rule (pre-commit + CI + required through `ci-success`) is satisfied by the existing gates.

## Alternatives

- **eslint + `eslint-plugin-sonarjs` for true cognitive complexity** — a second linter, second config, second version stream, for one rule whose intent is mostly covered by `complexity` + `max-depth` + `max-nested-callbacks` + `max-lines-per-function`. Rejected until oxc supports it natively.
- **Keep the ceiling at 10 (McCabe classic)** — industry-defensible but twice today's maximum; a gate nobody can hit for months guards nothing.

## Consequences

- Any function whose measured cyclomatic complexity exceeds 5 — every `if`/`case`/loop/`catch` and every `&&`/`||`/`??` counts — fails pre-commit and CI; the fix is decomposition, which the clean-code rules demand anyway. Engine routing logic (failover/round-robin trees) will feel this first — that pressure toward small pure functions is intended, and a genuine need for more headroom must argue its case in an ADR.
- Cognitive-complexity-specific smells that cyclomatic misses (deeply nested flat sequences, recursion penalties) stay uncovered until oxc ships the sonarjs plugin; the nesting ceilings blunt most of them meanwhile.
