# Rider ledger and code map: provider-subscriptions (tier full)

## 1. Rider ledger: empty, and the lookup succeeded

**Verdict: no open rider touches this feature. The ledger is empty, not broken.**

Command run, exactly as directed:

```
gh issue list --repo recomposesh/recompose --label rider --state open --limit 200 --json number,title,body
```

Result: exit status 0, response body `[]` (3 bytes). No error on stderr.

Because an empty array is indistinguishable from a bad label at first glance, I ran two confirmations before calling it empty:

1. **The label exists and is the right one.** `gh label list --repo recomposesh/recompose` returns `rider` with the description "Out-of-scope discovery parked from a fix cycle; read by the discovery phase". The label name is not a typo and the ledger convention is live.
2. **The label filter works.** The same query with `--state all` returns 13 issues, every one of them `CLOSED`: #113, #111, #110, #109, #108, #106, #104, #103, #100, #99, #93, #92, #90. The most recent closure is #113 on 2026-08-01T09:21:44Z; nine closed in one sweep on 2026-07-31T22:14:xx (the #112 rider sweep).

So the ledger is genuinely drained. No rider number carries into this feature, and I am not filing a lookup failure, because the lookup did not fail.

### One adjacent open issue, explicitly not a rider

`gh issue list --repo recomposesh/recompose --state open` returns 9 open issues, all with `"labels":[]`. One is squarely in this feature's blast radius:

- **#39, "Add vault-maintenance reconciliation for orphaned entries and dangling credential references."**

It carries no `rider` label, so by the rule I was given (judge labeled riders only) it is **not** part of the rider ledger and must not be counted as one. I name it because a feature that adds a new credential-bearing account kind walks straight into the dangling `credentialRef` problem it describes. Treat it as caller-visible context, not as an inherited rider.

Other open issues (#76, #47, #46, #45, #44, #43, #33, #7) are routing-mode and dependency-dashboard work with no credential or account surface.

---

## 2. What the feature is, from the change folder

`openspec/changes/provider-subscriptions/manifest.md` records `tier: full`, `phase: discovery`, `branch: worktree-provider-subscriptions`. The discovery briefs already on disk:

- `openspec/changes/provider-subscriptions/discovery/technical-research.md`
- `openspec/changes/provider-subscriptions/discovery/acceptance-references.md`
- `openspec/changes/provider-subscriptions/discovery/mobbin-references.md`

Both written briefs converge on the same reordering: the Anthropic half of `README.md` line 31 ("sign in with OAuth for Claude and Codex subscriptions") is prohibited by vendor terms, and the acceptance brief recommends splitting into **Mode A** (subscription pass-through, the client keeps the credential) and **Mode B** (credential-holding OAuth, reserved). The code map below marks which subsystem each mode lands in, because the two modes touch almost disjoint files.

---

## 3. Code map by subsystem

### 3.1 Contracts (shared workspace package, not FSD)

`packages/contracts/src/` is consumed by main, preload, renderer and engine, so a schema change here is the widest blast radius in the repo. It sits outside the FSD layer vocabulary; the renderer reaches it through the `@recompose/contracts` alias.

- `packages/contracts/src/accounts.ts`: `ACCOUNTS_VERSION`, `accountKindSchema` (currently `'subscription' | 'api-key' | 'aggregator'`), `accountsDocumentSchema`, `AccountsDocument`, `loadAccountsDocument`, `defaultAccountsDocument`. The persisted account already carries `provider`, `kind`, `label`, `credentialRef`. A rotating OAuth refresh token has no field here today; `credentialRef` points at one vault slot with no expiry, no refresh token, no rotation record.
- `packages/contracts/src/ipc.ts`: `connectAccountRequestSchema` (`provider`, `kind`, `label`, `secret`) plus the three channels `'accounts:list'`, `'accounts:connect'`, `'accounts:remove'`. The failure vocabulary already includes `'vault-unavailable'` and `'vault-newer-schema'`. Note the shape assumption: connect takes a **user-typed secret**, so an OAuth flow does not fit this request without a new channel or a new variant.
- `packages/contracts/src/gateway-config.ts`: the target variant of the exported `RoutingNode` union carries `accountId`, which is how a routing target binds to an account. `gatewayConfigSchema`, `GatewayConfig`, `loadGatewayConfig`, `GATEWAY_CONFIG_VERSION`.
- `packages/contracts/src/migration.ts` (`migrateDocument`, `Migration`) and `packages/contracts/src/index.ts` (barrel). `accountsMigrations` is currently an empty list, so any account-shape change needs the first entry, under the one-shape-per-version rule in `docs/adr/0062-a-schema-version-names-one-shape.md`.
- Specs that pin current behavior: `packages/contracts/src/accounts.test.ts`, `packages/contracts/src/ipc.test.ts`, `packages/contracts/src/ipc.test-d.ts`, `packages/contracts/src/migration.test.ts`.

### 3.2 Main process, credential storage (Mode B lands here)

- `packages/../apps/desktop/src/main/storage/vault.ts`: `VaultDocument`, `VaultNewerSchemaError`, `loadVaultFile`, `saveVaultFile`, `setSecret`, `getSecret`, `deleteSecret`. Refresh-token rotation means the stored value changes on every refresh, which this write path must absorb.
- `apps/desktop/src/main/storage/accounts-store.ts`: `loadAccountsFile`, `saveAccountsFile`.
- `apps/desktop/src/main/storage/vault-order.ts`: `inVaultOrder` serializes vault work; a background token refresh racing a user write goes through this gate.
- `apps/desktop/src/main/storage/safe-storage-codec.ts`: `SecretCodec`, `createSafeStorageCodec`.
- `apps/desktop/src/main/storage/initialize-storage.ts`, `apps/desktop/src/main/storage/json-file.ts`, `apps/desktop/src/main/storage/one-at-a-time.ts`.
- Governing records: `docs/adr/0016-storage-architecture.md`, `docs/adr/0047-gateway-token-vault-and-clipboard.md`.
- Existing specs: `apps/desktop/src/main/storage/vault.test.ts`, `vault-order.test.ts`, `accounts-store.test.ts`, `safe-storage-codec.test.ts`.

### 3.3 Main process, IPC surface

- `apps/desktop/src/main/ipc/storage-ipc.ts`: `createStorageIpcHandlers`, `StorageIpcHandlers`. Handles `'accounts:list'`, `'accounts:connect'`, `'accounts:remove'` (handler wiring at lines 234 to 237, connect and remove internals at lines 146 and 183).
- `apps/desktop/src/main/ipc/storage-context.ts`: `StorageIpcContext`, `StoragePaths`, `storagePathsFor`, `openVaultForWrite`.
- `apps/desktop/src/main/ipc/dispatch.ts`: `IpcHandlers`, `ipcChannelNames`, `dispatchIpc`. Any new OAuth channel must be added to `ipcChannelNames` or it will not dispatch.
- `apps/desktop/src/main/ipc/register-ipc.ts`: `registerIpcHandlers`.
- `apps/desktop/src/main/ipc/sender-trust.ts`, `apps/desktop/src/main/ipc/storage-envelope.ts`.
- Secret-leak guard already in place: `apps/desktop/src/main/ipc/storage-ipc-secret-hygiene.test.ts`. An OAuth token must clear the same bar.
- Governing record: `docs/adr/0018-typed-ipc-with-result-envelope.md`.

### 3.4 Main process, browser handoff and window policy (the OAuth loopback flow)

- `apps/desktop/src/main/windows/navigation-policy.ts`: `NavigationPolicy`, `isAllowedNavigation`, `ExternalOpenDecision`, `decideExternalOpen`. `decideExternalOpen` already returns `'open-https'` only for `https:` and drops everything else, which covers an authorization URL unchanged.
- `apps/desktop/src/main/windows/main-window.ts` line 67 is the single `shell.openExternal` call site in the app, reached from the window-open handler. Starting an OAuth flow from an IPC handler is a **new call path to an existing decision function**, not a policy widening.
- `apps/desktop/src/main/windows/permission-policy.ts`: `allowsPermission`. `docs/adr/0060-the-permission-policy-allows-one-clipboard-write.md` records exactly one allowed permission; a loopback flow needs none, so this file is read-only context.
- `apps/desktop/src/main/ipc/system-ipc.ts`: `SystemIpcContext`, `SystemIpcHandlers`, `createSystemIpcHandlers` (`'system:get'`, `'system:open-config-folder'`, `'system:sidebar-shown'`). This is the precedent for a main-side side-effect handler with an injected capability.
- Governing record: `docs/adr/0028-security-baseline.md` (records `recompose://` as reserved and unregistered).

### 3.5 Engine (Mode A pass-through lands here)

- `packages/engine/src/gateway-app.ts`: `createGatewayApp`. Today it serves `/health` and refuses every model path; there is **no upstream forwarding code yet**, so pass-through is new construction, not a modification.
- `packages/engine/src/refusals.ts`: `missingModelInAnthropicDialect`, `missingModelInOpenAiDialect`, `nonLoopbackClient`, `requestCarriesOrigin`, `unservedPath`.
- `packages/engine/src/loopback-guard.ts`: `guardLoopback`.
- `packages/engine/src/gateway-listener.ts`: `GatewayListeners`, `openGatewayListeners`.
- Governing record: `docs/adr/0057-the-engine-serves-over-hono.md`.

### 3.6 Renderer, by FSD layer

**app layer**

- `apps/desktop/src/renderer/src/app/routes/providers.tsx`: exports `Route` (`createFileRoute('/providers')`), validates a `kind` search param through `accountKindSchema`, warms `accountsQueryOptions` in its loader, and renders `ProvidersPage`. A new account kind changes what this route can address.
- `apps/desktop/src/renderer/src/app/routes/-app-shell.tsx`: `AppSidebar`, `AppToolbar`, `AppContent`.

**pages layer**

- `apps/desktop/src/renderer/src/pages/providers/index.ts`: public API, exports `ProvidersPage`.
- `apps/desktop/src/renderer/src/pages/providers/ui/providers-page.tsx`: `ProvidersPage`.
- `apps/desktop/src/renderer/src/pages/providers/ui/connect-account-form.tsx`: `ConnectAccountForm`. This is the form that assumes a pasted secret; an OAuth path either branches here or gets a sibling.
- `apps/desktop/src/renderer/src/pages/providers/ui/account-kind-field.tsx`: `AccountKindField`.
- `apps/desktop/src/renderer/src/pages/providers/ui/account-list.tsx`: `AccountList`.
- Story siblings already present and required by the stories guard: `connect-account-form.stories.tsx`, `account-kind-field.stories.tsx`, `account-list.stories.tsx`, `providers-page.stories.tsx`. Browser specs: `providers-page.browser.test.tsx`, `account-kind-field.browser.test.tsx`.

**widgets layer**

- `apps/desktop/src/renderer/src/widgets/provider/sidebar/index.ts`: public API, exports `ProviderSidebar`.
- `apps/desktop/src/renderer/src/widgets/provider/sidebar/ui/provider-sidebar.tsx`: `ProviderSidebar`, with `provider-sidebar.stories.tsx` and `provider-sidebar.browser.test.tsx` siblings. The sidebar groups accounts by kind, so a kind change or a new connection affordance shows here.

**entities layer**

- `apps/desktop/src/renderer/src/entities/account/index.ts`: public API.
- `apps/desktop/src/renderer/src/entities/account/model/account-kind.ts`: `AccountKind`, `accountKinds`, `accountKindTitle`, `accountsOfKind`. Spec: `account-kind.test.ts`. This is the one existing entity slice and it is consumed by both the providers page and the provider sidebar, so it earns its layer under the multi-consumer rule.

**shared layer**

- `apps/desktop/src/renderer/src/shared/api/accounts.ts`: `accountsQueryOptions`, `useConnectAccount`, `useRemoveAccount`.
- `apps/desktop/src/renderer/src/shared/api/ipc-result.ts`: `IpcResultError`, `refusalSentence`, `withRefusal`, `unwrapIpcResult`.
- `apps/desktop/src/renderer/src/shared/api/index.ts`: segment public API.
- `apps/desktop/src/renderer/src/shared/ui/index.ts`: the kit an OAuth screen would draw from, including `LabelledTextField`, `SegmentedControl`, `Sheet`, `StatusIndicator`, `FieldGroup`, `FieldRow`, `PageError`.

**FSD placement guidance for new code:** an OAuth connect flow used only by the providers screen stays in `pages/providers/`. It moves to `features/` only once a second consumer exists, and `features/` does not exist in this renderer today. Do not create the layer speculatively. Token shape and kind predicates belong in `entities/account/model/`, named by domain (for example `model/subscription.ts`), never `types.ts`. Nothing credential-bearing belongs in `shared/`, which holds no business logic.

### 3.7 End-to-end

- `apps/desktop/e2e/features/providers/accounts.feature`: two scenarios, connect an api-key account and remove it.
- `apps/desktop/e2e/steps/providers.steps.ts`: the matching Given/When/Then bindings, including "the maintainer connects an {string} api-key account labeled {string}". A subscription account needs its own step vocabulary; reusing the api-key step would hide the difference the feature exists to draw.

### 3.8 Documentation that the feature falsifies

- `README.md` line 31 currently promises "sign in with OAuth for Claude and Codex subscriptions". The acceptance brief marks this sentence false on acceptance and requires it to change in the same change set. `README.md` edits go through the `create-readme` skill.

---

## 4. Gaps and misses, reported rather than guessed

1. **No rider ledger entries exist.** Reported above with proof. Nothing inherited.
2. **No `features/` layer exists in the renderer.** `apps/desktop/src/renderer/src/` contains only `app`, `entities`, `pages`, `shared`, `widgets`. If a path hint pointed at `features/`, it resolves to nothing today.
3. **No OAuth, PKCE or token-refresh code exists anywhere in the repo.** The whole flow is new construction. I found no existing symbol to extend, and I have not invented one.
4. **The engine has no upstream forwarding path.** `createGatewayApp` refuses every model path today, so Mode A pass-through has no existing relay to modify.
5. **The account schema has no field for an expiring or rotating credential.** `credentialRef` is a single non-blank string with no expiry or refresh sibling. Any design that stores an OAuth grant needs a schema version bump plus the first entry in the currently empty `accountsMigrations`.
6. **No ADR covers OAuth account connection.** The nearest neighbours are `docs/adr/0047-gateway-token-vault-and-clipboard.md`, `docs/adr/0028-security-baseline.md` and `docs/adr/0016-storage-architecture.md`, none of which decides this.
7. **`openspec/changes/provider-subscriptions/discovery/mobbin-references.md` exists but I did not read it**; it is design reference and carries no code map.
