# 0081: Router engine parity waits for its feature

**Status**: Accepted
**Date**: 2026-08-07

## Context

The first virtual model serving slice intentionally replaced the unshipped version-one routing
tree with one direct target. The product architecture still places an optional, chainable router
between a virtual model and its targets. Router execution doesn't yet exist in contracts, main,
or the engine. Provider, authentication, translation, media, realtime, logging, and watcher
parity can advance without inventing that feature inside an unrelated change.

CLIProxyAPI contains scheduler, cooldown, weighting, quota, and concurrency machinery that can
guide the future router engine. Copying its auth-pool manager now would put an implicit routing
layer underneath recompose's explicit canvas graph. It would also import Home, Redis, PostgreSQL,
and plugin concerns that don't belong to the local desktop router.

## Decision

Router implementation waits for its own feature and OpenSpec change. The current engine
parity effort doesn't add router schemas, policy state, target fallback, round-robin cursors, or
router user interface.

The router feature starts with two built-in modes:

- `failover`: try the next healthy target in declared order.
- `round-robin`: distribute eligible requests evenly across targets.

The following modes remain in their existing issues and aren't folded into the first router
batch:

- `#33 auto`: local heuristic selection by default, with an optional inexpensive classifier and a
  cost-versus-quality control.
- `#43 weighted`: percentage traffic splitting; the historical target `weight` field is the
  reserved input.
- `#44 quota-aware`: proactive selection from provider quota headroom.
- `#45 sticky`: session affinity for provider prompt-cache locality.
- `#46 latency-based`: select by time to first token among healthy targets.
- `#47 cost-based`: select the least expensive healthy target.

Issue `#117` concerns subscription targets supplied to routers. It isn't a routing mode.

Provider transports may normalize stable error codes, `Retry-After`, quota timing, latency, and
usage now. They must not use those signals to select another target until the router feature owns
that decision.

## Future implementation source map

Use CLIProxyAPI v7.2.121 at commit
`8392b180ce3789eba9fd06ebc812b4fc237876e1` as the pinned reference. Start from these files:

- `sdk/cliproxy/auth/scheduler.go` and `scheduler_test.go`: ready-candidate selection, rotation,
  priority tiers, and mixed-provider scheduling.
- `sdk/cliproxy/auth/selector.go` and `selector_test.go`: selector boundaries and unavailable
  outcomes.
- `sdk/cliproxy/auth/weight.go`, `weight_test.go`, and
  `conductor_weight_validation_test.go`: weight normalization and invalid configuration.
- `sdk/cliproxy/auth/cooldown_state.go`, `cooldown_state_test.go`,
  `cooldown_backoff_test.go`, `connection_lifecycle_cooldown_test.go`, and
  `conductor_cooldown.go`: health state, retry timing, recovery, and lifecycle transitions.
- `sdk/cliproxy/auth/error_events.go` and `conductor_availability_test.go`: availability snapshots
  and the difference between an unavailable target with and without a future retry time.
- `internal/runtime/executor/codex_executor_terminal.go` and
  `codex_executor_retry_test.go`: capacity, usage-limit, context, signature, authentication, and
  retry timing signals.
- `internal/runtime/executor/antigravity_executor_credits.go` and
  `antigravity_executor_credits_test.go`: structured 429 classification and retry-delay parsing.
- `internal/runtime/executor/claude_executor_fast_error_test.go`: request-scoped failures that
  must not cool or rotate a target.

Don't port these implementation layers:

- `internal/home`, Home dispatch, or Home key-value coordination.
- `internal/store/postgres_cooldown_store.go`.
- Redis queues, cluster state, or distributed concurrency fencing.
- Plugin schedulers or plugin router callbacks.

Recompose's historical recursive shape remains available with:

```text
git show f2402ed^:packages/contracts/src/gateway-config.ts
```

It contains target nodes with `accountId`, `providerModel`, and `weight`, plus chainable
`failover` and `round-robin` router nodes. Treat it as a design input, not code to restore
unchanged. The current strict schemas, model alias grammar, migrations, and secret-custody
decisions came later.

Also consult:

- The Composable routing section in `README.md`.
- `BRAINSTORM-NOTES.md`, the router-mode and chaining decisions.
- `docs/superpowers/specs/2026-07-20-recompose-design.md`, section 4.1.
- `openspec/changes/gateway-virtual-models/discovery/technical-research.md`.
- `openspec/changes/gateway-virtual-models/discovery/acceptance-references.md`.

## Required implementation order

1. Open a dedicated router OpenSpec change and define its acceptance matrix before editing the
   serving path.
2. Version the gateway config. Migrate a direct target into the new graph without changing what
   existing gateways serve.
3. Validate graph references and acyclicity in contracts. Canvas-only cycle prevention isn't an
   engine safety boundary.
4. Keep target nodes credential-free. A selected target names `accountId` and `providerModel`;
   custody still resolves per attempt through main.
5. Implement pure failover and round-robin policy functions before adding mutable runtime state.
6. Key health and cooldown by the resolved router chain and target identity, never only by the
   client model alias.
7. Refresh an unauthorized subscription target once before making a router decision.
8. Allow fallback for pre-stream transport failures, retryable capacity/rate-limit outcomes, and
   eligible 5xx responses. Don't fallback for malformed requests, context length, invalid tool
   schemas, or thinking-signature failures.
9. Never begin a second target after downstream streaming has started. Forward the provider's
   stream error and record the failed attempt.
10. Add router modes from their issues only after failover and round-robin have full contracts,
    engine, watcher, Inter-Process Communication (IPC), and driven coverage.

## Consequences

**Good**: provider parity can proceed without an implicit account pool that contradicts the
canvas. The future router feature has pinned upstream references, failure rules, migration inputs,
and a test-first implementation order.

**Bad**: direct virtual model targets remain the only executable shape until the router feature
lands. Error and quota signals collected now have no routing consumer yet.

**Risk**: CLIProxyAPI may move before router work begins. The pinned commit remains the comparison
baseline. A fresh upstream audit must identify later behavioral changes rather than mixing
revisions.
