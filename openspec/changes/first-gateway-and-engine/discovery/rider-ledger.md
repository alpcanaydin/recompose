# Rider ledger for `openspec/changes/first-gateway-and-engine` (tier full)

## Verdict: the ledger is empty, and this is a real result, not a lookup failure

Zero open issues carry the `rider` label. The prescribed command ran clean and returned an empty array.

```
gh issue list --repo recomposesh/recompose --label rider --state open --limit 200 --json number,title,body
[]
(exit 0)
```

I did not treat the empty array as ambiguous. Three checks separate "no riders exist" from "the query missed them":

1. **The label exists and is the right one.** `gh label list --repo recomposesh/recompose` returns exactly one label named `rider`, described as "Out-of-scope discovery parked from a fix cycle; read by the discovery phase". There is no case variant or near-miss label the query could have skipped.
2. **The label has been used.** `--state all` returns three riders, so the ledger mechanism is live rather than dormant.
3. **The repo slug is correct.** Every `gh` call against `recomposesh/recompose` exited 0, confirming the slug in use.

## Why the ledger is empty: it was cleared immediately before this change opened

All three riders that ever existed are `CLOSED` with `stateReason: COMPLETED`, each burned down by a merged PR in the last handful of commits on `main`:

| Rider | Title                                                                                    | Closed by | Commit on `main` |
| ----- | ---------------------------------------------------------------------------------------- | --------- | ---------------- |
| #90   | Flow green drifts from the locked value in light mode                                    | PR #97    | `4f30ec8`        |
| #92   | A newer settings document is quarantined as corrupt instead of raising a downgrade error | PR #98    | `dec3e90`        |
| #93   | A local pnpm install leaves no Electron binary, so pnpm dev fails                        | PR #96    | `db37257`        |

The PR-to-issue linkage is not inferred from titles. Each PR's `closingIssuesReferences` field names its issue directly (#97 to #90, #98 to #92, #96 to #93).

**No prior out-of-scope rider touches this feature, because none remains open.**

## Residue from the closed riders that this feature inherits

These are **not** riders and do not enter the ledger. They are verified repository state that two of the closed riders left behind, on surfaces this feature's proposal explicitly claims.

**Rider #90 removed the token the status dot would have used.** The proposal ships "a status dot that reports running or stopped". PR #97 ("drop the success token nothing paints with") deleted `--color-success` outright: `grep -rn "color-success" apps/desktop/src/renderer/src/` returns no matches. The underlying primitives survive unmapped in `apps/desktop/src/renderer/src/app/styles/primitives.css` lines 6 and 7 (`--green-500: #32d74b`, `--green-600: #28cd41`). The running/stopped dot therefore has no semantic token to consume and will need one defined in `apps/desktop/src/renderer/src/app/styles/theme.css`. Flagging as a gap, not prescribing the fix.

**Rider #92's fix is already in place and needs nothing.** The proposal reads the engine port from the stored settings document. The downgrade path that rider covered now resolves: `settings-newer-schema` is a member of the error code union in `packages/contracts/src/ipc.ts` line 12, and is raised at `apps/desktop/src/main/ipc/storage-ipc.ts` line 61.

## Adjacent open issues that are NOT riders

Reporting these for completeness because they bear directly on the `engine` capability, with the explicit caveat that **none carries the `rider` label**, so none belongs in the ledger and none should be treated as parked scope from a prior fix cycle.

- **#76 "Engine: user-facing lifecycle hooks on canvas nodes"** (no labels, created 2026-07-26). This is the closest thing to a live constraint on the new capability in `openspec/changes/first-gateway-and-engine/specs/engine/spec.md`. Its Dependencies section states it is "Blocked by the engine runtime itself" and asks that "The engine design should treat each stage as a pure function so these hook points can wrap stages without rework." It also records that the `gateway-config` schema will later gain a per-node `hooks` field requiring a schema migration, which interacts with this change's decision to hold `GATEWAY_CONFIG_VERSION` at 1.
- **#33, #43, #44, #45, #46, #47** (no labels): routing-mode features (auto, weighted, quota-aware, sticky, latency-based, cost-based), all downstream of the engine runtime this change starts.
- **#39** (no labels): vault-maintenance reconciliation.

## Feature-Sliced Design placement of the cited renderer files

The renderer runs minimal FSD (`app/`, `pages/`, `shared/` only; no `widgets/`, `features/`, or `entities/` directories exist), which matches the skill's Section 5-3 minimal-layer guidance.

- `apps/desktop/src/renderer/src/app/styles/theme.css` and `apps/desktop/src/renderer/src/app/styles/primitives.css` sit in the **app** layer, correct for global stylesheets and tokens.
- `apps/desktop/src/renderer/src/pages/gateway-canvas/` is the **pages** layer slice that owns the empty state and the sidebar listing described in the proposal.
- `packages/contracts/` and `apps/desktop/src/main/` are outside the renderer and carry no FSD layer.

## Contract fact backing the proposal's stated impact

The proposal's claim that the gateway contract currently requires at least one virtual model is accurate. `packages/contracts/src/gateway-config.ts` line 59 reads `virtualModels: z.array(virtualModelSchema).min(1)`. Exported symbols in that file: `GATEWAY_CONFIG_VERSION`, `gatewaySlugSchema`, `RoutingNode`, `gatewayConfigSchema`, `GatewayConfig`, `loadGatewayConfig`.

## Gaps I am reporting rather than filling

- I found no rider describing the missing status-dot token. The gap is real in the code, but no issue records it, so I am not naming a phantom issue number for it.
- I did not search the repository for riders, per the mandate. If riders were ever parked as files or as comments rather than as labeled issues, this ledger would not see them, and I make no claim either way.
