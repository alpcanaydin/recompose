# Solution design

## Header and change linkage

- Change id: gateway-virtual-models
- Schema: recompose
- Proposal: [proposal.md](proposal.md)
- Specs: [specs/virtual-models/spec.md](specs/virtual-models/spec.md)
- Discovery: [discovery/](discovery/)
- Tasks: [tasks.md](tasks.md)

## Context

A gateway opens a loopback port, but its serving path answers every model request with a typed 404, because no virtual model exists. The dialect-translation library shipped, so a request in one dialect reaches a target that speaks another. This change binds a virtual name to one stored target and forwards traffic to it. It marks the first credential spend on live traffic. The design carries the three locked brainstorm decisions and the resumed refusal decision into a buildable shape.

## Discovery inputs consumed

- `discovery/brainstorm-decisions.md`: the custody hybrid, the caller surface, the model picked over typed, and the resumed 404/502/502 refusal decision shaped every section below.
- `discovery/technical-research.md`: the Claude Code gateway protocol set the discovery prefix hint, the byte-for-byte error rule, and the no-buffering rule. The router and pool sections stand consulted, no impact, because the slice binds one target.
- `discovery/mobbin-references.md`: the row-and-picker shape for a one-to-one binding fixed the Models surface as a list and a sheet, with no canvas.
- `discovery/rider-ledger.md`: rider #117 graduates into the driven suite, rider #138 folds the proxy fetch bound into contracts, and the account-kind helper seats the subscription refusal.
- `discovery/code-map.md`: the file map below cites its entries.
- `discovery/acceptance-references.md`: consulted, no impact beyond the scenarios the spec already carries.

## Goals and non-goals

**Goals:**

- One virtual model binds to one target, defined through a sheet and listed as a row.
- The target picker offers the key, aggregator, and local kinds, and refuses a subscription at parse.
- The gateway proxies a defined name to its target, resolving the credential per request.
- Three refusals answer typed: unknown-model 404, missing-target 502, missing-credential 502.
- `GET /v1/models` lists the defined models on both dialects, and the answer names the model that served.
- `gateway-config` moves to version 2 with a restamp migration.

**Non-goals:**

- No router, pool, or failover ladder.
- No canvas.
- No subscription target.
- No `/v1/responses` ingress route.
- No advertise toggle: the slice lists every defined model, and a per-model hide flag waits for a reason to exist.

## Constraints and invariants

Project rules, binding verbatim:

- TypeScript maximum strictness, always: `strict: true` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`. No `any`, no `as` casts to silence errors.
- Never write code comments. Code explains itself through naming and structure.
- The `feature-sliced-design` decision tree places every renderer file, and a new `ui/` component owns a folder with its `*.stories.tsx` sibling.
- Never disable, override, loosen, or silence any gate.
- Test code changes if and only if behavior changes.

Feature invariants:

- The credential rides neither a command line, an environment variable, nor a disk file. It resolves per request and lives in the handler's function scope.
- Every proxied path passes `guardLoopback`, so loopback-only and no-Origin hold.
- The gateway streams the answer through and buffers nothing.
- A real upstream error body forwards byte for byte. recompose context rides response headers, never the body.
- The system prompt attribution block stays first and unchanged in the `system` array.
- The virtual name reuses the shipped slug grammar. It never becomes a URL segment, because each gateway owns its own port.
- No refusal falls back to another target.
- Bindings ride the start directive as a snapshot. Secrets ride the per-request grant.

## Design

### The stored shape moves to version 2

`gatewayConfigSchema` holds a list of virtual models. Version 1 admitted a routing node with a router arm and a weight. Version 2 drops both. A virtual model carries a slug id, a display name, and one target. The target carries an account id and one real model name. The target's kind refuses a subscription at parse, so the forbidden binding has no shape. `migrateDocument` restamps a version 1 document to version 2 and rewrites only the stamp, because no shipped writer ever minted a virtual model.

### The custody hybrid resolves secrets per request

Two channels carry a gateway to the child. The start directive carries the bindings as a snapshot: the virtual model names, the display names, and the target standings, never a secret. The engine answers `GET /v1/models` and the refusals from that snapshot. A secret rides a per-request grant instead. When a request arrives under a defined name, the child asks the parent over a correlated lane for a spend grant. The parent resolves the target against the live registry and the vault under the vault order. The grant returns the credential, and it lives in the handler's function scope until the upstream headers leave. Removal and key replacement take effect on the next request, because the parent resolves against live state every time.

This follows the probe arm's precedent. `engine-child.ts` already hands a key to `probeKey` over the message port rather than argv or env, and the grant lane reuses that shape. The grant's refused arms are enums with no message field, so a refusal names a state rather than a string.

### The proxy request path consumes the translator

A model request reaches `gateway-app.ts`, and `guardLoopback` clears it. The app reads the virtual name from the request's `model` field and looks it up in the snapshot. An unknown name answers 404. A known name asks the parent for a spend grant. The parent answers a missing target or a missing credential, and each answers 502. A resolved grant hands the request to the dialect translator, which crosses it from the arriving dialect to the target's dialect. A key or aggregator target speaks Chat Completions, so a request from Claude Code crosses the hub on the way out. The gateway forwards the crossed request to the target's provider origin, carrying the real model name and the credential header. The answer streams back through the translator to the caller's dialect.

### The three refusals split by meaning

The refusal vocabulary in `refusals.ts` gains a missing-target and a missing-credential refusal in both dialects, beside the shipped missing-model one. An unknown name renders 404 `not_found_error` on the Anthropic envelope and `model_not_found` on the OpenAI one. A missing target and a missing credential each render 502, because a listed model with broken backing is a bad-gateway condition rather than an absent resource. Each refusal names what's missing in the arriving dialect's own envelope. A real upstream error forwards byte for byte, so the slice synthesizes a status only for these three.

### The caller surface serves discovery

`GET /v1/models` answers unauthenticated on loopback with one merged body. The Anthropic shape reads `{ data: [{ type: "model", id, display_name }], first_id, has_more, last_id }`, and the OpenAI shape reads `{ object: "list", data: [{ id, object: "model" }] }`. Claude Code reads only the id and the display name, so the payload stays minimal. The listing answers under the three-second budget with no redirect. The `count_tokens` path stops reading a blanket 404. Claude Code's picker ignores an id that doesn't begin with `claude` or `anthropic`, so the sheet previews a prefixed wire id and hints at the filter. The virtual name itself stays free.

### The Models surface anchors in the drawer, and the design project is its source of truth

The maintainer approved the drawer proposal in the design project (`templates/gateway-models`) with one vocabulary rule. User-facing copy names the alias a virtual model, never a bare model, so the drawer reads "Serves · 2 virtual models" and "Add virtual model." The provider's own model keeps the plain Model label.

The gateway screen takes the design system's shell: the content stage in the middle and the inspector drawer on the right, per the `recompose-design-system` project's `templates/gateway-detail`. The canvas stays out of this slice, so the stage holds a calm empty state and the topology arrives with the later canvas feature. The defined models live in the drawer's Serves section, each row reading the virtual name with its target and a target-removed standing, with the Copy model id act. Adding a model runs as a drawer flow ordering its fields Name, Target, then Model, with the maintainer settling the concrete composition in the design project before the surface lands. The target picker groups accounts by kind through the shipped `accountKindTitle` vocabulary and offers the key, aggregator, and local kinds, with a search once the list outgrows the screen. Provider display names live in a page slice a widget can't reach under Feature-Sliced Design. Each row leads with its provider mark instead, so the provider stays visible inside every group. The Model field fills from the target account's live model list. A person picks the model rather than typing it.

### The model list fills over a probe lane

The sheet's Model field fetches the target account's live model list over a probe-style lane, the same shape the key probe already runs. A failed fetch reads a typed refusal in the sheet that names the failed look. The field offers no free-text fallback, so a virtual model never binds to a model the account can't serve.

### Attribution stays truthful

The response names the model that answered in the body and in `message_start`, rather than echoing the virtual name. It adds `x-recompose-*` headers naming the virtual model and the target that served. Echoing the upstream model leaks the abstraction the alias hides. The streaming case forces the choice anyway, because `message_start` reaches the wire before the body. Anthropic, Cloudflare, and LiteLLM all chose truthful attribution over a stable lie.

## Data model and contracts

### gateway-config version 2

- `virtualModelSchema`: `{ id: gatewaySlugSchema, displayName: nonBlankString, target: targetSchema }`. The router node and its weight leave the schema.
- `targetSchema`: `{ accountId: nonBlankString, providerModel: nonBlankString }`, refused when the referenced account resolves to a subscription kind.
- `GATEWAY_CONFIG_VERSION` reads 2, and `migrateDocument` carries version 1 forward with a stamp rewrite.

### The offered-kinds refusal

`entities/account/model/account-kind.ts` gains an `accountsStandingAsTarget` filter that drops the subscription kind, named after the contract's own refusal sentence, because the file already ships an unrelated `offeredAccountKind`. The stored `targetSchema` refuses a subscription target at parse, so the prohibition holds in the contract as well as the picker.

### The engine protocol snapshot

`engineGatewaySchema` widens to carry the virtual model bindings: the id, the display name, and the target standing per model, never a credential. The child answers listings and refusals from this snapshot alone.

### The credential grant lane

A new correlated child-to-parent message asks for a spend grant by gateway slug and virtual model id. The parent answers a resolved grant carrying the provider origin and, for a credentialed target, the credential, or a refused grant naming a missing target or a missing credential. A local target resolves without a credential, because a local account stores none and its runtime answers open on loopback. The missing-credential refusal therefore binds only to the credentialed kinds. The refused arms are enums with no message field. The proxy sends a granted credential as a bearer authorization header and sends no credential header on an open grant.

## Error handling

The three refusals model expected failures as typed results rather than thrown surprises. The unknown-name refusal reads from the snapshot without a parent round trip. The missing-target and missing-credential refusals arrive as the refused arms of the spend grant. Each renders through the shipped refusal projector in the arriving dialect's envelope. A real upstream error never enters this path, because the gateway forwards its body and status byte for byte.

## File map

- `packages/contracts/src/gateway-config.ts`: version 2 of the stored shape, one strict target per virtual model (modify)
- `packages/contracts/src/migration.ts`: the version 1 to version 2 restamp (modify)
- `packages/contracts/src/engine-protocol.ts`: the bindings snapshot and the grant-lane message pair (modify)
- `packages/contracts/src/index.ts`: the barrel exports the new shapes (modify)
- `packages/engine/src/gateway-app.ts`: the proxy path and the `GET /v1/models` listing replace the model-path 404 handlers (modify)
- `packages/engine/src/refusals.ts`: the missing-target and missing-credential refusals in both dialects (modify)
- `packages/engine/src/engine-child.ts`: the per-request spend-grant lane (modify)
- `packages/engine/src/engine-runtime.ts`: the resolved bindings enter the running gateway through `start` (modify)
- `apps/desktop/src/main/engine-host/spend-grants.ts`: the grant round trip resolving a target and its credential (create)
- `apps/desktop/src/main/ipc/storage-ipc.ts`: `gateways:save` stays create-only, and a `gateways:update` channel rewrites the stored document for an existing slug, because adding a model amends a gateway that already stands (modify)
- `apps/desktop/src/renderer/src/pages/gateway-canvas/ui/*`: the stage, the drawer, the Serves rows, and the add-model flow, pages layer (create)
- `apps/desktop/src/renderer/src/pages/gateway-canvas/model/*` and `lib/*`: the served-models derivation, the draft library, and the draft hook, pages layer (create). The add-model flow lives in the page rather than a widget, because the Feature-Sliced Design insignificant-slice rule merges a one-consumer slice into its consumer.
- `apps/desktop/src/renderer/src/entities/account/model/account-kind.ts`: the `offeredAccountKind` filter, entities layer (modify)
- `apps/desktop/src/renderer/src/shared/api/gateways.ts`: the save path carries virtual models (modify)
- `apps/desktop/src/renderer/src/shared/api/provider-models.ts`: the model-list probe query, shared layer (create)
- `apps/desktop/src/renderer/src/shared/testing/fake-bridge.ts`: `gatewaySeed` learns `virtualModels` (modify)
- `apps/desktop/e2e/features/virtual-models/*`: the graduated scenarios (create)
- `apps/desktop/e2e/steps/virtual-models-*.steps.ts`: their step files (create)
- `apps/desktop/e2e/gateway-screen.ts`: the Models list and add-model sheet page objects (modify)
- `apps/desktop/e2e/gateway-client.ts`: the proxied-answer reader (modify)

## Interfaces

Consumes:

- `translateRequest`, `translateResponse`, and `translateStream` from `packages/engine/src/dialect/dispatcher.ts`
- `guardLoopback` from `packages/engine/src/loopback-guard.ts`
- `getSecret` from `apps/desktop/src/main/storage/vault.ts`
- `loadAccountsFile` from `apps/desktop/src/main/storage/accounts-store.ts`
- `gatewaySlugSchema`, `slugFromName`, and `nonBlankString` from `@recompose/contracts`
- `Sheet` and `SheetActionSlot` from `shared/ui`

Produces:

- `virtualModelSchema`, `VirtualModel`, `targetSchema`, `Target`, and `GATEWAY_CONFIG_VERSION` from `packages/contracts/src/gateway-config.ts`
- the widened `engineGatewaySchema` and the spend-grant message pair from `packages/contracts/src/engine-protocol.ts`
- the missing-target and missing-credential refusal factories from `packages/engine/src/refusals.ts`
- `accountsStandingAsTarget` from the account entity's public API

## Decisions

One numbered block per choice. A decision that meets the Architecture Decision Record (ADR) bar links its draft.

### 1. Custody is the hybrid

Bindings ride the start directive as a snapshot, and secrets ride a per-request grant. A snapshot of live keys in child memory would sit beside the child's pipes to the parent console, so the grant keeps a secret's residence short. The cost is a parent round trip per request, which the design accepts for the custody duration it buys.

**Alternatives considered:** whole credentials on the start directive, rejected on custody duration. Every-request name resolution with no snapshot, rejected because listings and unknown-name refusals need no parent round trip.

**ADR draft:** lands with the implementation, beside the grant lane.

### 2. The caller surface is in scope

`GET /v1/models` and the truthful attribution ship with the proxy, rather than waiting. A gateway that serves traffic but hides its models forces manual client config, which the discovery protocol exists to spare.

**Alternatives considered:** proxy-only slice with discovery deferred, rejected because the first client integration would immediately need manual model variables.

**ADR draft:** none, the decision stays inside this change's scope.

### 3. The person picks the real model

The Model field fills from the account's live list, and a failed fetch refuses typed. A free-text field would let a virtual model bind to a model the account can't serve, and the refusal would move from the sheet to live traffic.

**Alternatives considered:** free-text with validation on save, rejected because the refusal arrives after the person committed the form. A free-text fallback beside the picker died at the brainstorm.

**ADR draft:** none, a screen-level rule the spec carries.

### 4. Refusal statuses are 404 / 502 / 502

An unknown name is 404, because the model doesn't exist and never lists. A missing target and a missing credential are 502, because a listed model with broken backing is a bad-gateway condition. A 503 would promise a retry that a permanent misconfiguration never earns.

**Alternatives considered:** uniform 404, rejected because it mislabels a listed model as absent. The 404/503/503/502 split, rejected because 503 reads as transient while the fault is permanent.

**ADR draft:** lands with the implementation, beside the refusal vocabulary.

### 5. gateway-config moves to version 2

The router node and its weight leave the file for one strict target per virtual model. A restamp migration carries version 1 forward without a data rewrite, because no shipped writer ever minted a virtual model.

**Alternatives considered:** keeping the router arm dormant in the schema, rejected because a stored shape the spec forbids invites a writer for it.

**ADR draft:** none, the migration follows the shipped schema-version rule.

## Test matrix

| Layer          | What this layer proves (or why none)                                                                                           | Check command                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit           | the subscription refusal at parse, the restamp migration, the refusal envelopes and statuses, the offered-kinds filter         | `pnpm --filter @recompose/contracts run test`, `pnpm --filter @recompose/engine run test`, `pnpm --filter @recompose/desktop run test`                            |
| Integration    | the proxy resolves a grant and forwards to a fake provider origin, refused grants answer 502, the listing serves both dialects | `pnpm --filter @recompose/engine run test`                                                                                                                        |
| End-to-end     | a person defines a model through the sheet, the picker holds no subscription, a defined name proxies, refusals answer typed    | `pnpm --filter @recompose/desktop run test:e2e`                                                                                                                   |
| Property       | every stored version 1 document restamps to a valid version 2 document                                                         | `pnpm --filter @recompose/contracts run test`                                                                                                                     |
| Mutation scope | the changed contracts, engine, and main modules against the diff-scoped break-80 gate                                          | `pnpm --filter @recompose/engine run test:mutation`, `pnpm --filter @recompose/contracts run test:mutation`, `pnpm --filter @recompose/desktop run test:mutation` |

Designated mutant killers:

- The subscription refusal in `targetSchema`: a test binds a subscription account and asserts the parse refusal.
- The status split: a test asserts 404 for unknown-model and 502 for both config faults, so a mutant that collapses them dies.
- The snapshot-versus-grant split: a test asserts a listing answers without a grant round trip, and a proxied request asks for one.

## Task decomposition hooks

- Task 1: gateway-config version 2 (depends on: none, hands off: `virtualModelSchema`, `targetSchema`, `GATEWAY_CONFIG_VERSION`)
- Task 2: the engine protocol snapshot and the grant lane (depends on: none, hands off: the widened `engineGatewaySchema` and the grant message pair)
- Task 3: the missing-target and missing-credential refusals (depends on: none, hands off: the refusal factories in both dialects)
- Task 4: the proxy path and the model listing (depends on: 1, 2, 3, hands off: the serving behavior the e2e suite drives)
- Task 5: the spend-grant round trip in main (depends on: 1, 2, hands off: the parent-side grant handler)
- Task 6: the offered-kinds helper (depends on: 1, hands off: `offeredAccountKind` through the entity barrel)
- Task 7: the Models surface (depends on: 1, 6, hands off: the list, the sheet, and the probe query the e2e suite drives)
- Task 8: the driven scenarios (depends on: 4, 5, 7, hands off: the graduated feature suite)

## Risks

- [Risk] Codex speaks the Responses dialect and its Chat Completions support carries a deprecation notice → Mitigation: flagged, not taken; a Codex target waits on a `/v1/responses` ingress route in a later slice.
- [Risk] The per-request grant adds a parent round trip to every proxied request → Mitigation: the lane reuses the shipped probe round trip's shape, and the listing path skips it entirely.
- [Risk] The discovery prefix filter hides an unprefixed alias from Claude Code's picker → Mitigation: the sheet previews a prefixed wire id and hints at the filter.

## Migration and rollout

The version 1 to version 2 migration restamps the document and rewrites no binding, because no shipped writer ever minted a virtual model, so no version 1 file holds one. A document that fails the version 2 schema stays quarantined through the shipped newer-schema path. The change ships behind no flag, because the serving path already answers the model routes, and this slice replaces the 404 with a proxy or a typed refusal.

## Open questions

None.

## End-to-end verification

The final observable check runs in the development app. Define a virtual model `fast` on a gateway bound to a stored key account. Then POST a model request under `fast` to the gateway's loopback port and read the answer stream, the truthful model name, and the `x-recompose-*` attribution headers.

A fresh-context reviewer diffs the result against five criteria. The picker offered no subscription account. The listing names `fast` on both dialects. An unknown name answers 404. A removed target and a missing credential each answer 502 in the arriving dialect's envelope. No credential appears on the spawn command line, in the environment, or in a disk file.
