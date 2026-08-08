# Rider ledger for `gateway-virtual-models` (tier full)

**Lookup: succeeded.** `gh issue list --repo recomposesh/recompose --label rider --state open --limit 200 --json number,title,body` returned 10 open riders: #117, #118, #119, #120, #121, #122, #123, #136, #137, #138. Judged below by body text against `openspec/changes/gateway-virtual-models/specs/virtual-models/spec.md` and `openspec/changes/gateway-virtual-models/manifest.md`.

## In scope: one rider, and this feature is its named trigger

### #117 "A virtual model never offers a subscription target"

The tenth approved scenario of `provider-subscriptions`, deferred because "no screen carries a composition surface yet." This feature is that surface, and its second requirement ("A subscription account never stands as a target") is the same prohibition. The rider graduates here.

Sources:

- `openspec/changes/archive/2026-08-03-provider-subscriptions/tasks.md:39` records the deferral: nine of ten scenarios drive the running app, the tenth "waits on the composition surface, which no screen carries yet."
- Scenario text, `openspec/changes/archive/2026-08-03-provider-subscriptions/gherkin/subscriptions/managed-account.feature:11-14`: `Given a gateway named "codex" exists` / `When the maintainer composes a virtual model for "codex"` / `Then the offered targets carry no subscription account`.
- The surviving living-spec requirement is `openspec/specs/subscriptions/spec.md`, scenario "a gateway never lists a subscription among its targets."
- Confirmed still ungraduated: `apps/desktop/e2e/features/subscriptions/managed-account.feature` carries only two scenarios ("The row says what the account serves", "Signing in through the tool stores no credential recompose could route with"). The virtual-model scenario is absent from the driven suite.

**Gap to report (path drift, not a miss on my side).** The rider body points the scenario text at `openspec/changes/provider-subscriptions/gherkin/`, which no longer exists; the archive step (bbecbd0) moved it to `openspec/changes/archive/2026-08-03-provider-subscriptions/gherkin/subscriptions/managed-account.feature`. Same for the `tasks.md` reference. Whoever picks the rider up should be handed the archived paths.

**Load-bearing detail the rider does not know.** The rider claims the contract half "already holds structurally, because the version 2 account row union can't store a subscription credential reference." That is now understated and one screen-side hazard is live:

- `packages/contracts/src/accounts.ts:8` reads `ACCOUNTS_VERSION = 4`, not 2. `subscriptionAccountSchema` (line 18) still carries no `credentialRef`; `credentialedAccountSchema` (line 27) gates it behind `credentialedAccountKindSchema = z.enum(['api-key', 'aggregator'])` (line 14). `localAccountSchema` (line 38) has since joined the discriminated union (line 47) with `address: loopbackAddressSchema`, so the picker owes three kinds, matching the spec's "key, aggregator, and local."
- The screen half has a trap. `apps/desktop/src/renderer/src/entities/account/model/account-kind.ts:22` exports `accountKinds: readonly AccountKind[] = accountKindSchema.options`, and `accountKindSchema` (`packages/contracts/src/accounts.ts:10`) is `z.enum(['subscription', 'api-key', 'aggregator', 'local'])`. A target picker built on `accountKinds` or on `accountsOfKind` (same file, line 35) offers subscriptions unless it filters explicitly. That is precisely what #117's scenario asserts against.

## Adjacent: four riders that want a decision, none blocking

### #138 key-probe fetch bound follows the runtime bound into contracts

This feature makes the gateway spend a credential on live traffic for the first time, so it introduces an outbound fetch bound of its own. The duplication the rider names is verified: `packages/engine/src/provider/key-probe.ts:3` holds `probeFetchBoundMs = 10_000` privately, `apps/desktop/src/main/engine-host/engine-host-probe.test.ts:9` re-declares `childFetchBoundMs = 10_000`, and the contracts home the rider wants is `packages/contracts/src/local-runtimes.ts:20` (`runtimeLookBoundMs = 3_000`). Decision: land the proxy's bound in contracts rather than add a third private copy.

### #136 a stored runtime's port can move without remove-and-add

Local accounts are an offered target kind, and their address is stored on the row (`packages/contracts/src/accounts.ts:38-43`, `localAccountSchema.address`). A moved `OLLAMA_HOST` leaves a bound virtual model proxying to a dead port, which lands inside this feature's typed-refusal requirement. `packages/engine/src/refusals.ts` already carries `code: 'model_not_found'` (line 11) and the message `The gateway "${displayName}" holds no virtual model.` (line 16). Decision: whether the refusal taxonomy distinguishes a stale local address from a removed target.

### #137 base-compare the provider-catalog-sheet load flake

The spec requires that adding a virtual model "MUST run through a sheet." The flaking test is `apps/desktop/src/renderer/src/pages/providers/ui/provider-catalog-sheet/provider-catalog-sheet.browser.test.tsx`, and a new virtual-model sheet rides the same primitive, `apps/desktop/src/renderer/src/shared/ui/sheet/sheet.tsx` (with `sheet.browser.test.tsx` beside it). The new sheet's browser test inherits the flake class under full-project load. Worth resolving before a second sheet test joins the suite.

### #118 keep the credential blob out of /usr/bin/security argv

Same invariant, different path. This feature's spec says the credential "MUST NOT ride a command line, an environment variable, or a disk file on the way," and `apps/desktop/src/main/subscriptions/macos-keychain.ts:78` passes the blob as an argv element: `['add-generic-password', '-U', '-s', item.service, '-a', item.account, '-w', blob]`. That module is subscription-only, and subscriptions are excluded as targets here, so it is not on this feature's request path (key and aggregator credentials resolve through `apps/desktop/src/main/storage/vault.ts`). Its riding-along exclusion claims all still hold: `apps/desktop/stryker.config.json:16-19` and `apps/desktop/vitest.config.ts:35-38` both exclude `macos-keychain.ts`, `run-command.ts`, `sign-in-launch.ts`, `subscriptions-wiring.ts` (while `apps/desktop/src/main/subscriptions/macos-keychain.test.ts` exists), and `.github/workflows/codeql.yml:44` ignores `apps/desktop/e2e`.

## Out of scope: five riders, with reasons

- **#123 `subscriptions:activate` stands without a surface.** Its body names an account switching UI as the owning surface, not virtual-model composition, and subscriptions never stand as targets here.
- **#119 macOS sign-in completion can outrun the identity write.** Subscription sign-in only.
- **#120 `parkInto` reports success without refreshing a stale parked slot.** Subscription credential parking only.
- **#121 terminal launch failures are swallowed on every platform.** Subscription sign-in only.
- **#122 e2e fake tools lack `codex.mts`.** Verified still true (`apps/desktop/e2e/fake-tools` holds `claude.mts`, `keychain.mts`, `keychain.test.mts`, `sign-in-launcher.mts`), but nothing in it drives a virtual model.

## FSD placement for the surfaces the ledger touches

| Path                                                                                                                                                | Layer / slice / segment                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `apps/desktop/src/renderer/src/app/routes/gateways.$slug.tsx`                                                                                       | app (routing)                                |
| `apps/desktop/src/renderer/src/pages/gateway-canvas/index.ts` (exports `GatewayCanvasPage`)                                                         | pages, `gateway-canvas` slice, public API    |
| `apps/desktop/src/renderer/src/pages/gateway-canvas/ui/gateway-canvas-page/gateway-canvas-page.tsx`                                                 | pages, `gateway-canvas`, `ui`                |
| `apps/desktop/src/renderer/src/widgets/gateway/{create,sidebar,toolbar}`                                                                            | widgets, `gateway` slice group, three slices |
| `apps/desktop/src/renderer/src/entities/account/model/account-kind.ts` (`accountKinds`, `accountsOfKind`, `offeredAccountKind`, `accountKindTitle`) | entities, `account` slice, `model`           |
| `apps/desktop/src/renderer/src/shared/ui/sheet/sheet.tsx`                                                                                           | shared, `ui`                                 |
| `apps/desktop/src/renderer/src/pages/providers/ui/provider-catalog-sheet/provider-catalog-sheet.browser.test.tsx`                                   | pages, `providers` slice, `ui`               |

Node-side counterparts (outside FSD): `packages/contracts/src/accounts.ts`, `packages/engine/src/refusals.ts`, `packages/engine/src/gateway-app.ts`, `packages/engine/src/provider/key-probe.ts`, `apps/desktop/src/main/storage/vault.ts`.

**Budget note.** I stayed inside the read budget and did not open `packages/engine/src/gateway-app.ts` in full, so the proxy's current request path (how `model_not_found` is raised and where a target would resolve) is named from a grep of `refusals.ts` rather than read end to end. The gateway page also has no `models` surface yet: `pages/gateway-canvas` holds a single `ui` segment and no `model` or `api` segment, so the Models list and its sheet are net-new slices, not edits.
