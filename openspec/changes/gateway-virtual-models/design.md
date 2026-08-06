# Gateway virtual models design

## Header and change linkage

This design serves the `gateway-virtual-models` change, tier full, resumed on top of the shipped dialect-translation library. It carries the three locked brainstorm decisions and the resumed refusal decision into a buildable shape. The spec it satisfies lives at `specs/virtual-models/spec.md`.

## Context

A gateway opens a loopback port, but its serving path answers every model request with a typed 404, because no virtual model exists. The dialect-translation library shipped, so a request in one dialect reaches a target that speaks another. This change binds a virtual name to one stored target and forwards traffic to it. It marks the first credential spend on live traffic.

## Discovery inputs consumed

- `discovery/brainstorm-decisions.md`: the custody hybrid, the caller surface in scope, the model picked over typed, and the resumed 404/502/502 refusal decision.
- `discovery/technical-research.md`: the Claude Code gateway protocol, the discovery prefix filter, the byte-for-byte error rule, and the no-buffering rule.
- `discovery/mobbin-references.md`: the row-and-picker shape for a one-to-one binding, with no canvas.
- `discovery/rider-ledger.md`: rider #117 graduates here, and the account-kind helper seats the subscription refusal.
- `discovery/code-map.md`: the file map every section below cites.

## Goals and non-goals

Goals:

- One virtual model binds to one target, defined through a sheet and listed as a row.
- The target picker offers the key, aggregator, and local kinds, and refuses a subscription at parse.
- The gateway proxies a defined name to its target, resolving the credential per request.
- Three refusals answer typed: unknown-model 404, missing-target 502, missing-credential 502.
- `GET /v1/models` lists the defined models on both dialects, and the answer names the model that served.
- `gateway-config` moves to version 2 with a restamp migration.

Non-goals:

- No router, pool, or failover ladder.
- No canvas.
- No subscription target.
- No `/v1/responses` ingress route.
- No advertise toggle: the slice lists every defined model, and a per-model hide flag waits for a reason to exist.

## Constraints and invariants

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

### The Models surface is a list, a sheet, and a picker

The `gateway-canvas` page trades its placeholder for a Models list. A row reads in the shipped row language: a lead mark, the virtual name over its target on two lines, and a trailing state that reads the target-removed standing. The Copy model id act sits on the row. Adding a model runs through the shared `Sheet` primitive. The sheet orders its fields Name, Target, then Model. The target picker groups accounts by provider and offers the key, aggregator, and local kinds, with a search once the list outgrows the screen. The Model field fills from the target account's live model list. A person picks the model rather than typing it.

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

`entities/account/model/account-kind.ts` gains an `offeredAccountKind` filter that drops the subscription kind. The stored `targetSchema` refuses a subscription target at parse, so the prohibition holds in the contract as well as the picker.

### The engine protocol snapshot

`engineGatewaySchema` widens to carry the virtual model bindings: the id, the display name, and the target standing per model, never a credential. The child answers listings and refusals from this snapshot alone.

### The credential grant lane

A new correlated child-to-parent message asks for a spend grant by gateway slug and virtual model id. The parent answers a resolved grant carrying the credential and the provider origin, or a refused grant naming a missing target or a missing credential. The refused arms are enums with no message field.

## Error handling

The three refusals model expected failures as typed results rather than thrown surprises. The unknown-name refusal reads from the snapshot without a parent round trip. The missing-target and missing-credential refusals arrive as the refused arms of the spend grant. Each renders through the shipped refusal projector in the arriving dialect's envelope. A real upstream error never enters this path, because the gateway forwards its body and status byte for byte.

## File map

### Contracts

- `packages/contracts/src/gateway-config.ts`: `virtualModelSchema` and `targetSchema` move to version 2, the router node leaves, and `GATEWAY_CONFIG_VERSION` reads 2.
- `packages/contracts/src/migration.ts`: a version 1 to version 2 restamp.
- `packages/contracts/src/engine-protocol.ts`: `engineGatewaySchema` carries the bindings snapshot, and a new grant-lane message pair.
- `packages/contracts/src/index.ts`: the barrel exports the new shapes.

### Engine

- `packages/engine/src/gateway-app.ts`: the proxy path and the `GET /v1/models` listing replace the model-path 404 handlers.
- `packages/engine/src/refusals.ts`: the missing-target and missing-credential refusals in both dialects.
- `packages/engine/src/engine-child.ts`: the per-request spend-grant lane.
- `packages/engine/src/engine-runtime.ts`: the resolved bindings enter the running gateway through `start`.

### Main

- `apps/desktop/src/main/engine-host`: the spend-grant round trip that resolves a target and pulls its credential.
- `apps/desktop/src/main/storage/vault.ts`: `getSecret` answers the grant, and a missing entry is the missing-credential refusal.
- `apps/desktop/src/main/storage/accounts-store.ts`: a removed account is the missing-target refusal.

### Renderer

- `apps/desktop/src/renderer/src/pages/gateway-canvas`: a `model` segment and an `api` segment for the Models list and the add-model sheet.
- `apps/desktop/src/renderer/src/entities/account/model/account-kind.ts`: the `offeredAccountKind` filter.
- `apps/desktop/src/renderer/src/widgets/gateway`: a virtual model slice mirroring the create-gateway sheet and its draft hook.
- `apps/desktop/src/renderer/src/shared/api`: the model-list probe query and the save path.

### End-to-end

- `apps/desktop/e2e/gateway-screen.ts` and `gateway-client.ts`: the page objects extend for the Models list, the add-model sheet, and the proxied answer.
- A new `features/virtual-models` directory carries the driven scenarios, including rider #117's graduated one.

## Interfaces

- The stored schema is the contract every writer and the child share, so the subscription refusal and the one-target rule hold by construction.
- The grant lane is the only channel a secret rides, and it answers a resolved or a refused grant.
- The caller surface is `GET /v1/models`, the proxied model paths, and the typed refusals, each in the arriving dialect's envelope.

## Decisions

### 1. Custody is the hybrid

Bindings ride the start directive as a snapshot, and secrets ride a per-request grant. A snapshot of live keys in child memory would sit beside the child's pipes to the parent console, so the grant keeps a secret's residence short. The cost is a parent round trip per request, which the design accepts for the custody duration it buys.

### 2. The caller surface is in scope

`GET /v1/models` and the truthful attribution ship with the proxy, rather than waiting. A gateway that serves traffic but hides its models forces manual client config, which the discovery protocol exists to spare.

### 3. The person picks the real model

The Model field fills from the account's live list, and a failed fetch refuses typed. A free-text field would let a virtual model bind to a model the account can't serve, and the refusal would move from the sheet to live traffic.

### 4. Refusal statuses are 404 / 502 / 502

An unknown name is 404, because the model doesn't exist and never lists. A missing target and a missing credential are 502, because a listed model with broken backing is a bad-gateway condition. A 503 would promise a retry that a permanent misconfiguration never earns.

### 5. gateway-config moves to version 2

The router node and its weight leave the file for one strict target per virtual model. A restamp migration carries version 1 forward without a data rewrite, because no shipped writer ever minted a virtual model.

## Test matrix

- Unit: `targetSchema` refuses a subscription target; the migration restamps a version 1 document; each refusal renders in both dialect envelopes with the right status.
- Integration: the proxy path resolves a grant and forwards to the provider origin; a missing target and a missing credential each refuse 502; `GET /v1/models` answers a merged body on both dialects.
- End-to-end: a person defines a model through the sheet; the picker offers no subscription; a defined name proxies to the fake provider; an unknown name refuses 404; a removed target refuses 502.

### Designated mutant killers

- The subscription refusal in `targetSchema`: a test binds a subscription account and asserts the parse refusal.
- The status split: a test asserts 404 for unknown-model and 502 for both config faults, so a mutant that collapses them dies.
- The snapshot-versus-grant split: a test asserts a listing answers without a grant round trip, and a proxied request asks for one.

## Risks

- Codex speaks the Responses dialect, and its Chat Completions support carries a deprecation notice. A Codex target waits on a `/v1/responses` ingress route, which this slice leaves out. Flagged, not taken.
- The per-request grant adds a parent round trip to every proxied request. The design measures it against the shipped probe round trip, which runs the same lane.
- The discovery prefix filter hides an unprefixed alias from Claude Code's picker. The sheet's prefixed wire id and its hint carry the remedy.

## Migration and rollout

The version 1 to version 2 migration restamps the document and rewrites no binding, because no shipped writer ever minted a virtual model, so no version 1 file holds one. A document that fails the version 2 schema stays quarantined through the shipped newer-schema path. The change ships behind no flag, because the serving path already answers the model routes, and this slice replaces the 404 with a proxy or a typed refusal.
