# Rider ledger for `provider-api-keys` (tier full)

## Lookup

`gh issue list --repo recomposesh/recompose --label rider --state open --limit 200 --json number,title,body` returned **7 open riders**: #123, #122, #121, #120, #119, #118, #117. The command succeeded, so this is a real ledger, not a lookup failure.

Judgement was made on issue body text, then checked against the repository so each verdict names code rather than a guess.

## Blocking gap: the feature has no stated scope

`openspec/changes/provider-api-keys/` holds only two files:

- `openspec/changes/provider-api-keys/.openspec.yaml` (`schema: recompose`, `created: 2026-08-02`)
- `openspec/changes/provider-api-keys/manifest.md`, whose front matter carries `tier: full`, `phase: discovery`, `approvals: []`, `branch: worktree-api-keys` and **no description, proposal, or delta**

Every conditional verdict below turns on one unanswered question: **does this feature ship only the API-key connect/list/remove flow on the providers surface, or does it also ship the surface that composes a virtual model from connected accounts?** Two riders (#117, #123) flip from in-scope to still-waiting on that answer. Please supply the scope statement rather than let me pick one.

Load-bearing fact for that question, from the code: an API-key account already exists in part. `credentialedAccountKindSchema` (`'api-key' | 'aggregator'`) and `CredentialedAccount` with its `credentialRef` live in `packages/contracts/src/accounts.ts`, the connect form is `apps/desktop/src/renderer/src/pages/providers/ui/connect-key-form.tsx` (`ConnectKeyForm`), and the surface is `apps/desktop/src/renderer/src/pages/providers/ui/credentialed-surface.tsx` (`CredentialedSurface`). So the feature extends an existing slice; it does not start one.

## Riders that touch this feature

### #117 — "A virtual model never offers a subscription target" — CONDITIONAL, strongest hit

The tenth approved scenario of `provider-subscriptions`, deferred because "no screen carries a composition surface yet."

Why it lands here: an API-key account is precisely what a virtual-model target points at. `packages/contracts/src/gateway-config.ts` defines `targetSchema` as a strict object carrying `accountId`, and `virtualModelSchema` collects those targets into `virtualModels`. The composition surface still does not exist: `apps/desktop/src/renderer/src/pages/gateway-canvas/` holds only `ui/gateway-canvas-page.tsx` and `ui/gateway-canvas-page.stories.tsx`. If `provider-api-keys` builds the screen where an account becomes a target, this rider graduates inside this change; if the feature stays on the providers surface, it keeps waiting.

**Stale pointer in the rider body.** #117 points at `openspec/changes/provider-subscriptions/gherkin/` and `openspec/changes/provider-subscriptions/tasks.md`. Neither path resolves: commit `bbecbd0` archived the change. The scenario now lives at `openspec/changes/archive/2026-08-03-provider-subscriptions/gherkin/subscriptions/managed-account.feature`, line 11, as `Scenario: A virtual model never offers a subscription target`, and the deferral note is in `openspec/changes/archive/2026-08-03-provider-subscriptions/tasks.md`. The issue body should be corrected when this rider is picked up.

### #123 — "subscriptions:activate stands without a surface since the menu prune" — CONDITIONAL, weak

The rider's claim verifies exactly. The channel is declared in `packages/contracts/src/ipc.ts` (`'subscriptions:activate'`), bridged in `apps/desktop/src/preload/index.ts`, and handled by `activate` in `apps/desktop/src/main/ipc/subscriptions-ipc.ts`. The only renderer callers are the fake bridge `apps/desktop/src/renderer/src/shared/testing/fake-subscriptions.ts` and `apps/desktop/src/renderer/src/shared/testing/fake-bridge.browser.test.ts`. No production renderer code calls it.

It touches this feature only if `provider-api-keys` adds a per-row action to the shared list `apps/desktop/src/renderer/src/pages/providers/ui/account-list.tsx` (`AccountList`), which both kinds render through. Note the channel itself is subscription-only: activation swaps the vendor keychain item, so an API-key row action will not consume it. Treat #123 as a pattern precedent, not a dependency.

### #118 — "Keep the credential blob out of /usr/bin/security argv" — PARTIAL, through its ride-alongs only

The main defect is **not** on the API-key path. `securityKeychain` in `apps/desktop/src/main/subscriptions/macos-keychain.ts` passes the blob in argv (`['add-generic-password', '-U', '-s', item.service, '-a', item.account, '-w', blob]`), but that writer serves subscriptions alone: `custodyOver` in `apps/desktop/src/main/subscriptions/credential-custody.ts` hands custody out only when `provider === 'anthropic'`. An API key takes a different road entirely, through `connectAccount` in `apps/desktop/src/main/ipc/storage-ipc.ts`, which mints `credentialRef` and writes via `setSecret(opened.vault, ctx.getCodec(), credentialRef, request.secret)` into the vault file (`apps/desktop/src/main/storage/vault.ts`, `apps/desktop/src/main/storage/safe-storage-codec.ts`). Removal mirrors it through `releaseKeyRow` and `deleteSecret`.

Two ride-alongs in #118 do bind, if this feature adds code in those places:

- CodeQL skips the e2e tree: `.github/workflows/codeql.yml` lists `apps/desktop/e2e` among its ignored paths. Any child-process e2e helper the API-key work adds goes unscanned.
- The coverage exclusions in `apps/desktop/vitest.config.ts` and the Stryker `mutate` negations in `apps/desktop/stryker.config.json` both carry the same four entries (`macos-keychain.ts`, `run-command.ts`, `sign-in-launch.ts`, `subscriptions-wiring.ts`). All four are subscription files, so they bind only if API-key work reaches into them.

**Design fork to settle in this feature:** if `provider-api-keys` decides to move key custody from the vault file to the OS keychain, #118's argv defect becomes an in-scope blocker rather than an adjacent one.

## Riders that do not touch this feature

- **#120 — parkInto reports success without refreshing a stale parked slot.** Verified in `apps/desktop/src/main/subscriptions/credential-custody.ts`: `parkInto` writes only when `held !== null` yet `attempt` still answers `{ ok: true }`. Subscription custody only, per `custodyOver` in the same file.
- **#119 — macOS sign-in completion can outrun the identity write.** Sits in the subscription poll: `apps/desktop/src/main/subscriptions/subscription-views.ts` gates on `custody.vendorStands()` and reads `observed.signedInAs` for the one-address-one-account match. An API-key connect has no poll and no identity read.
- **#121 — Terminal launch failures are swallowed on every platform.** The swallow is `.catch(() => undefined)` in `apps/desktop/src/main/ipc/subscriptions-ipc.ts`; the dead Linux message is `no terminal emulator on this machine could run ${command}` in `apps/desktop/src/main/subscriptions/sign-in-launch.ts`. An API-key connect launches no terminal.
- **#122 — e2e fake tools lack codex.mts.** Shims are installed by `apps/desktop/e2e/subscription-tools.ts`. `apps/desktop/e2e/fake-tools/` holds `claude.mts`, `keychain.mts`, `keychain.test.mts`, and `sign-in-launcher.mts`; of these only `claude.mts` is a provider CLI, so the rider's substance (no codex shim) holds even though "only claude.mts exists" reads loosely against the directory. An API-key connect needs no CLI shim.

## Summary for the planner

| Rider                  | Verdict                                                                                                                                | Turns on            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| #117                   | Graduates **if** this feature ships virtual-model composition                                                                          | Feature scope       |
| #123                   | Precedent **if** this feature adds account row actions                                                                                 | Feature scope       |
| #118                   | Ride-alongs bind **if** this feature adds e2e or main-process code; argv defect binds **only if** key custody moves to the OS keychain | Storage design fork |
| #119, #120, #121, #122 | Out of scope, subscription-only paths                                                                                                  | Settled             |

No rider was invented, and no symbol is reported that the repository does not export. The one thing I will not decide for you is the scope question in the gap section.
