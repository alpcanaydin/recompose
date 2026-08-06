## Implementation tasks

Eight tasks. Tasks 1, 2, and 3 run first and together on disjoint files, because the stored shape, the engine protocol, and the refusal vocabulary gate everything downstream. Task 6 waits on task 1. Tasks 4, 5, and 7 wait on their gates and run together on disjoint files. Task 4 owns the engine, task 5 owns the main process, and task 7 owns the renderer. Task 8 waits on 4, 5, and 7, because it drives the running app.

Every task opens with a named failing test, captures the red run it started from, and drives it to green. Test code changes if and only if behavior changes. A `ui/` component ships its `*.stories.tsx` sibling before the branch leaves the machine, and anything that reaches the screen gets looked at through `claude-in-chrome` in both schemes.

- [ ] **Task 1: gateway-config version 2.** Owns `packages/contracts/src/gateway-config.ts`, its test, and the gateway-config migration entry. Gates every task, and runs beside tasks 2 and 3 on disjoint files.
  - [ ] Opens red: a config binding a subscription account as a target fails to parse, and a version 1 document restamps to version 2, before the schema moves.
  - [ ] `virtualModelSchema` carries a slug id, a display name, and one target. `targetSchema` carries an account id and one real model name, and refuses a subscription account kind. The router node and its weight leave the schema, `GATEWAY_CONFIG_VERSION` reads 2, and the restamp migration carries a version 1 document forward without a binding rewrite.
  - [ ] Layers: unit, and type-level for the schema-inferred `VirtualModel` and `Target` shapes.

- [ ] **Task 2: the engine protocol snapshot and the grant lane.** Owns `packages/contracts/src/engine-protocol.ts` and its test. Gates tasks 4 and 5, and runs beside tasks 1 and 3 on disjoint files.
  - [ ] Opens red: `engineGatewaySchema` carries a virtual model binding snapshot, and a spend-grant request and answer pair parses, before the protocol widens.
  - [ ] `engineGatewaySchema` gains the bindings snapshot: the id, the display name, and the target standing per model, never a secret. The grant lane adds a request keyed by gateway slug and virtual model id, and an answer that's a resolved grant carrying the credential and the provider origin, or a refused grant naming a missing target or a missing credential. The refused arms are enums with no message field.
  - [ ] Layers: unit, and type-level for the grant union.

- [ ] **Task 3: the missing-target and missing-credential refusals.** Owns the additions to `packages/engine/src/refusals.ts` and `refusals.test.ts`. Depends on nothing, and runs beside tasks 1 and 2 on disjoint files.
  - [ ] Opens red: a missing-target refusal renders 502 in both dialects, and a missing-credential refusal renders 502 in both dialects, each naming what's missing, before the refusals exist.
  - [ ] `refusals.ts` gains the two refusals beside the shipped missing-model one. An unknown model keeps its 404, and each config fault renders 502 through the shipped `RenderedRefusal`. The Anthropic envelope reads its error type, and the OpenAI envelope reads its code. The shipped `gateway-app.test.ts` 404 specs stay green.
  - [ ] Layers: unit.

- [ ] **Task 4: the proxy path and the model listing.** Owns `packages/engine/src/gateway-app.ts`, its test, `packages/engine/src/engine-child.ts`, and `packages/engine/src/engine-runtime.ts`. Depends on tasks 1, 2, and 3. Runs beside tasks 5 and 7 on disjoint files.
  - [ ] Opens red: a request under a defined name asks for a grant and forwards to the target origin under the real model name, an unknown name answers 404, and `GET /v1/models` answers a merged body, before the proxy replaces the 404 handlers.
  - [ ] `gateway-app.ts` reads the virtual name from the request's `model` field and looks it up in the snapshot. An unknown name answers 404 without a grant round trip. A known name asks the parent for a spend grant over the child lane in `engine-child.ts`. A refused grant answers 502. A resolved grant crosses the request through the dialect translator to the target's dialect, forwards it to the provider origin with the real model name and the credential header, and streams the answer back through the translator. `GET /v1/models` answers a merged body on both dialects, the `count_tokens` path stops reading a blanket 404, and `guardLoopback` clears every path. `engine-runtime.ts` carries the bindings into `start`.
  - [ ] Rider #138: the proxy's outbound fetch bound lands in contracts beside the runtime look bound, not as a third private copy.
  - [ ] Layers: unit, integration against a fake provider origin, and stream.

- [ ] **Task 5: the spend-grant round trip in main.** Owns the grant handler under `apps/desktop/src/main/engine-host` and its tests, plus the snapshot resolution at the start path. Depends on tasks 1 and 2. Runs beside tasks 4 and 7 on disjoint files.
  - [ ] Opens red: a grant request resolves a key account's credential from the vault and its provider origin, a local account resolves open with its stored address and no credential, a removed account answers a missing target, and a vault miss on a credentialed account answers a missing credential, before the handler exists.
  - [ ] The parent-side handler resolves the target against `storage/accounts-store.ts` and pulls its secret from `storage/vault.ts` under the vault order, and maps the outcome onto the resolved or refused grant. A local target resolves without a credential. The credential rides the message port, and the spawn site stays free of a secret on the command line or in the environment. The grant lives in the handler's function scope.
  - [ ] Snapshot resolution belongs here too: the start path reads the stored `virtualModels`, checks each target against the live registry, and mints the bound or removed standing the directive snapshot carries.
  - [ ] Layers: unit, integration.

- [ ] **Task 6: the offered-kinds helper.** Owns `apps/desktop/src/renderer/src/entities/account/model/account-kind.ts`, its test, and the entity barrel. Depends on task 1. Runs beside tasks 4 and 5.
  - [ ] Opens red: `offeredAccountKind` keeps the key, aggregator, and local kinds and drops the subscription kind, before the filter exists.
  - [ ] `account-kind.ts` gains the `offeredAccountKind` filter, and the entity barrel exports it. The picker in task 7 reads the offered kinds through it, so a subscription account has nowhere to appear.
  - [ ] Layers: unit.

- [ ] **Task 7: the Models surface.** Owns the renderer's Models work under `apps/desktop/src/renderer/src/pages/gateway-canvas`, a virtual model slice under `apps/desktop/src/renderer/src/widgets/gateway`, and the model-list probe query and save path under `apps/desktop/src/renderer/src/shared/api`. Depends on tasks 1 and 6, and its composition waits on the maintainer settling the drawer design in the `recompose-design-system` project. Runs beside tasks 4 and 5 on disjoint files.
  - [ ] Opens red: the Serves section renders a defined model as a row, the add-model flow's picker offers no subscription account, and the Model field refuses typed on a failed probe, before the surface exists.
  - [ ] The gateway screen takes the design system's shell: a calm stage in the middle (the canvas arrives as its own later feature) and the inspector drawer on the right. The defined models live in the drawer's Serves section, each row reading the virtual name with its target, a target-removed standing, and a Copy model id act. Adding a model runs as a drawer flow ordering its fields Name, Target, then Model, with the concrete composition settled in the design project first. The picker groups accounts by kind through the offered-kinds helper, with a search over a long list. The Model field fills from the target account's live model list over the probe query, and a failed fetch reads a typed refusal in the flow. The draft maps a main-process refusal onto a field message, mirroring the create-gateway draft.
  - [ ] Every new `ui/` component ships its `*.stories.tsx` sibling, and the fake bridge learns to seed `virtualModels` and accounts of every kind. Each new component and story gets looked at through `claude-in-chrome` in both schemes.
  - [ ] The Model field consumes the model-list query through the shared api seam, which the fake bridge answers in tests; the live lane behind that seam is task 7b's.
  - [ ] Layers: unit for the draft library, browser for the components and their stories, and integration through the fake bridge.

- [ ] **Task 4c: the Anthropic wire codec.** Owns a new `anthropic-*` codec family under `packages/engine/src/dialect/` and the gateway ingress updates its arrival forces in task 4's files. Depends on task 4 landing, because the ingress behavior changes from hub-shaped to wire-true. Runs alone.
  - [ ] Opens red: a real Anthropic wire request (`max_tokens`, string content, `cache_control`, `tool_choice`) decodes to the hub, and a hub answer encodes back to the wire response and the wire stream events (`message_start`, `content_block_start`, deltas, stops), before the codec exists.
  - [ ] The dialect library stops treating the Anthropic dialect as the hub identity: the wire codec decodes an Anthropic Messages request into the hub and encodes the hub back out, over request, response, and stream, with the same fates discipline every other codec holds. The gateway's `/v1/messages` ingress becomes wire-true, so a real Claude Code body serves rather than refusing.
  - [ ] Layers: unit, property (roundtrip fixed point), and stream.

- [ ] **Task 7b: the live model-list lane and the update lane.** Owns the model-list directive and report arms in `packages/contracts/src/engine-protocol.ts`, the fetch in `packages/engine/src/engine-child.ts` beside the probe arm, the main handlers and their `ipcChannels` entries, the wiring in `register-ipc.ts`, and the one renderer switch point task 7 names in its report. Depends on tasks 4, 5, and 7, because it edits the same engine and main files and flips task 7's persistence seam. Runs alone.
  - [ ] Opens red: the renderer's model-list query reaches the target account's live model list through main and the engine child, and a failed fetch answers a typed refusal the sheet can read, before the lane exists.
  - [ ] The lane mirrors the key-probe desk: the renderer asks through the `ipcChannels` table, main resolves the account and its credential under the custody rules, the engine child fetches the provider's model list, and the ids travel back. No credential rides argv, env, or disk, and the fetch respects the contracts fetch bound.
  - [ ] The update lane: `gateways:save` stays create-only and its three conflict specs stay untouched, because that behavior never changes. A new `gateways:update` channel rewrites the stored document for a slug that already exists and refuses an unknown slug. Task 7's persistence call switches from save to update at the single point its report names, and the add-model happy path goes green here.
  - [ ] Layers: unit, integration.

- [ ] **Task 8: the driven scenarios.** Owns `apps/desktop/e2e/features/virtual-models`, its steps, and the extensions to `apps/desktop/e2e/gateway-screen.ts` and `gateway-client.ts`. Depends on tasks 4, 5, and 7.
  - [ ] Opens red: the define, targets, and proxy features fail against the running app before the flows serve them.
  - [ ] The features drive a person defining a virtual model through the sheet, the picker offering no subscription account, a defined name proxying to a fake provider origin, an unknown name refusing, a removed target refusing, and a missing credential refusing. Rider #117's graduated scenario, a gateway offering no subscription target, joins this suite. The page objects gain the Models list, the add-model sheet, and the proxied-answer reader, and the seeding helpers write `virtualModels`, accounts of every kind, and a vault credential.
  - [ ] Layers: e2e.

## Verification

- The adversarial reviewer pair reads the proxy path and the custody lane before the commit chain, with a judge on a disagreement.
- The rules reviewer reads the changed code against the project rules.
- The diff-scoped Stryker gate covers the changed node-side logic, and the designated mutant killers in `design.md` pin the subscription refusal, the status split, and the snapshot-versus-grant split.
- The pull request runs the full machine gates, and the CodeRabbit protocol governs the review threads.
