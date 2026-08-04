## Rider ledger read

Command run: `gh issue list --repo recomposesh/recompose --label rider --state open --limit 200 --json number,title,body`. It succeeded and returned **seven** open riders, all filed off PR #116 (`provider-subscriptions`): #117, #118, #119, #120, #121, #122, #123. No lookup failure.

## Riders that touch `provider-aggregators-locals`

**#123 "subscriptions:activate stands without a surface since the menu prune" — touches, stays parked.**
The body says the channel waits on "a later surface (account switching UI)". This feature adds two more account surfaces and two more row shapes, so it is the next candidate owner, but neither approved spec asks for an activation act: `openspec/changes/provider-aggregators-locals/specs/aggregators/spec.md` names only the absence of a Verify act, and `openspec/changes/provider-aggregators-locals/specs/local-runtimes/spec.md` names only the live standing. The channel is built end to end (`packages/contracts/src/ipc.ts:112`, `apps/desktop/src/main/ipc/subscriptions-ipc.ts:287`, `apps/desktop/src/main/ipc/dispatch.ts:35`, `apps/desktop/src/preload/index.ts:52`), so it stays surfaceless after this feature unless the row overflow work deliberately picks it up.

**#118 "Keep the credential blob out of /usr/bin/security argv" — touches through its riding-along bullets only.**
The defect half does not reach this feature: an aggregator key is a credentialed row that stores through the file vault (`apps/desktop/src/main/storage/vault.ts`, exporting `setSecret`, `getSecret`, `deleteSecret`) by way of `connectAccount` in `apps/desktop/src/main/ipc/connect-account.ts:70`, never through `apps/desktop/src/main/subscriptions/macos-keychain.ts`. Both riding-along bullets check out against the tree and land inside this feature's blast radius:

- The two exclusion lists are real and adjacent: `apps/desktop/vitest.config.ts:35-38` and `apps/desktop/stryker.config.json:16-19` both exclude the same four subscription files. Local runtime detection adds main-side code doing real localhost I/O, the exact shape that gets pushed onto those lists, and this rider is the standing record that they should shrink rather than grow.
- The CodeQL exclusion is confirmed: `.github/workflows/codeql.yml:44` ignores `apps/desktop/e2e`. A fake local runtime server for the detection scenarios lands in that unscanned directory.

**#117 "A virtual model never offers a subscription target" — touches, does not graduate here.**
Its unblock condition is "the first surface that composes a virtual model from connected accounts". This feature adds no such surface: `apps/desktop/src/renderer/src/pages/gateway-canvas/` holds a single `ui/gateway-canvas-page/gateway-canvas-page.tsx`, and the virtual-model wording lives in `apps/desktop/src/renderer/src/widgets/gateway/create/lib/use-gateway-draft.ts`. The contract half the body cites still holds structurally, now at version 3: `packages/contracts/src/accounts.ts:17-22` gives `subscriptionAccountSchema` no `credentialRef`. What changes is the scope of the eventual scenario: this feature widens the eligible-target set with `aggregator` (already storable) and `local` (not yet storable), so the scenario text under `openspec/changes/provider-subscriptions/gherkin/` will need to say which kinds may appear, not only which may not.

## Riders that do not touch it

- **#119** macOS sign-in completion outruns the identity write: sign-in polling against `.claude.json`, no analogue here (aggregators paste a key, locals carry no credential).
- **#120** `parkInto` reports success on a stale slot: vendor keychain custody, `apps/desktop/src/main/subscriptions/credential-custody.ts`.
- **#121** terminal launch failures swallowed: `apps/desktop/src/main/subscriptions/sign-in-launch.ts`, no launch step in either spec.
- **#122** e2e fake tools lack `codex.mts`: subscription sign-in shims under `apps/desktop/e2e/fake-tools/`. Not unblocked, but a shape precedent worth reading, because the local runtime seams are `apps/desktop/e2e/key-probe-stub.ts` and `apps/desktop/e2e/loopback-ports.ts`, not `fake-tools`.

**No rider graduates from this feature.** Three carry a note into it (#117, #118, #123); one informs the e2e approach (#122).

## Code map the rider claims rest on

Renderer, Feature-Sliced Design layers:

- **entities** — `apps/desktop/src/renderer/src/entities/account/model/account-kind.ts`: `accountKinds`, `offeredAccountKind`, `accountKindTitle`, `accountsOfKind`. Lines 12-13 already title `aggregator: 'Aggregators'` and `local: 'Local Runtimes'`; lines 20-21 record that `local` browses to a destination holding nothing "because the document refuses to store a local row".
- **pages** — `apps/desktop/src/renderer/src/pages/providers/model/provider-catalog.ts` is the main seam: `export type ConnectionWay = Exclude<AccountKind, 'local'>` (line 18) is the type that currently locks locals out, alongside `catalogEntries`, `awaitedFor`, `offerFor`, `offeredUnder`, `keyKindOf`, `keyTitleFor`, `keyHostFor`, `keyShapeHintFor`, `markFor`, and `checkableKey` (line 217), the gate the "no Verify on an aggregator row" requirement runs through.
- **pages/ui** — `apps/desktop/src/renderer/src/pages/providers/ui/catalog-flow/catalog-flow.tsx:53` `CatalogFlow`, `catalog-list/catalog-list.tsx:82` `CatalogList`, `connect-key-form/connect-key-form.tsx:153` `ConnectKeyForm`, `key-account-row/key-account-row.tsx:92` `KeyAccountRow` (Verify sits in `quieterActions` at line 65 behind `checkableKey`), `local-runtimes-note/local-runtimes-note.tsx:11` `LocalRuntimesNote` (the placeholder this feature replaces), plus `credentialed-surface/`, `credentialed-empty-state/`, `kind-empty-state/`. Public API: `apps/desktop/src/renderer/src/pages/providers/index.ts` exports `AddProviderAct` and `ProvidersPage`.
- **widgets** — `apps/desktop/src/renderer/src/widgets/provider/sidebar/ui/provider-sidebar/`.
- **shared** — `apps/desktop/src/renderer/src/shared/api` (`useVerifyKey`, `useRemoveAccount`, `withRefusal`) and `apps/desktop/src/renderer/src/shared/testing/fake-bridge.ts`.

Outside FSD (main, preload, contracts): `packages/contracts/src/accounts.ts` (`ACCOUNTS_VERSION = 3`, `accountKindSchema` already enumerating `aggregator` and `local` at line 9, `credentialedAccountKindSchema = ['api-key', 'aggregator']` at line 13, and `accountSchema` at line 37 unioning only subscription and credentialed rows, which is why a `local` row cannot be stored); `packages/contracts/src/ipc.ts:69-78` (`accounts:list`, `accounts:connect`, `accounts:remove`, `accounts:check-key`); `apps/desktop/src/main/storage/accounts-store.ts` (`loadAccountsFile`, `saveAccountsFile`, `amendAccountsFile`).

## Gaps

- `openspec/changes/provider-aggregators-locals/` holds only `manifest.md` and the two spec files. There is no `proposal.md`, `design.md`, or `tasks.md` yet, so I judged the riders against the manifest and the two approved specs. If a design document lands that adds a composition surface or an activation act, #117 and #123 need re-judging.
- I did not verify whether `local` needs a fourth schema version or a third union member; that is a design call, not a ledger fact. What I can cite is that `accountSchema` (`packages/contracts/src/accounts.ts:37`) admits no `local` row today.
