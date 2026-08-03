# Provider-api-keys design

## Header and change linkage

- Change id: provider-api-keys
- Schema: recompose
- Proposal: [proposal.md](proposal.md)
- Specs: [specs/api-keys/spec.md](specs/api-keys/spec.md)
- Discovery: [discovery/code-map.md](discovery/code-map.md), [discovery/technical-research.md](discovery/technical-research.md), [discovery/acceptance-references.md](discovery/acceptance-references.md), [discovery/rider-ledger.md](discovery/rider-ledger.md)
- Tasks: [tasks.md](tasks.md)

## Context

The providers screen shipped the subscriptions design language: a kind-scoped surface, a catalog behind one Add provider act, and rows that read as the product a person connected. The API Keys destination behind it still renders the placeholder list, one line of label over "provider · kind" beside a bare Remove button. The catalog already offers the two key ways, Anthropic API and OpenAI API, and the key form asks for the key alone and names the account itself.

Four structural gaps stand between that placeholder and the shipped language. A key row has nothing safe to show beside its name, because the mask a row wants would need a vault read on every list. No process can ask a vendor whether a stored key works, because main sits behind the `desktop-not-into-engine` wall and the vendor dialects live in the engine. The pasted secret never trims, so a trailing newline reaches the vault today and later breaks header building with nothing on screen to explain it. And the catalog's awaited list for the kind stands empty, so the screen hides where it grows rather than saying it.

The design turns the locked decisions into contracts, files, tests, and task boundaries. It versions the accounts document for the mask tail and opens the key vocabulary in contracts. It teaches the engine child to probe a key and rebuilds the key surface in the sibling's anatomy.

## Discovery inputs consumed

- Code map, `provider-catalog.ts` entry: `awaitedFor('api-key')` answers empty and no key twin of `subscriptionTitleFor` exists, so the seven awaited entries and `keyTitleFor` land there.
- Code map, `account-list.tsx` entry: the placeholder this change supersedes, so it retires with its stories.
- Code map, `connect-key-form.tsx` entry: the form names the account itself, so it gains the name field and the foreign-shape warning.
- Code map, `storage-ipc.ts` entry: `connectAccount` writes the vault before any name check, so the per-provider refusal lands ahead of the write.
- Code map, `vault.ts` entry: `getSecret` has no production caller, so the check path becomes its first.
- Code map, `gateway-app.ts` entry: the engine already knows both vendors' path families, which is where dialect knowledge stays.
- Code map, `ipc.ts` and `dispatch.ts` entries: one channel lands, and the hand-kept `ipcChannelNames` roster moves with it.
- Code map, `README.md` entry: line 31 promises a base-URL endpoint no code path offers, so the sentence rewrites in this change.
- Research finding 2, the free authenticated read: `GET /v1/models` becomes the probe on both sides.
- Research finding 4, ask never probe: consulted, and it keeps the custom endpoint inert, because no dialect field exists to ask with.
- Research finding 5, no format gate and keys that expire: the contract refuses nothing about shape, and the verdict copy speaks as of the check.
- Research finding 6, the reveal toggle: consulted, no impact. The entry field keeps its masked type, and a reveal affordance is its own later question.
- Research finding 7, the catalog dependency: consulted and followed. The nine entries stay committed data rather than a fetched list.
- Research finding 8, the base URL as an exfiltration path: it keeps Custom endpoint in the awaited list rather than in this round's form.
- Research finding 9, upstream bodies: no upstream byte reaches a message or the screen, which shapes the report schema below.
- Acceptance section 1: verification as an explicit act, a 401 that never names its cause, and a connect that never gates on a check.
- Acceptance section 2: the tail-only mask, minted in main at connect time, stored as a non-secret field.
- Acceptance section 3: the per-provider name refusal with the existing code, before the vault write.
- Acceptance section 4: the seven inert entries with what each lacks, which becomes their benefit copy.
- Acceptance section 5: the trim at the contract boundary, the interior control character refusal, and the warn-never-refuse rule for foreign shapes.
- Rider ledger, #118: the argv defect class binds the custody decision, so the key travels in one message and never in argv.
- Rider ledger, #117: the virtual model target stays waiting, because no composition surface lands in this change.
- Rider ledger, #123: consulted as row-act precedent, no dependency.

## Goals and non-goals

**Goals:**

- The API Keys destination lists nine catalog entries: two connect, and seven stand inert under a Soon badge with an honest benefit line.
- Connecting asks a name and a key, and nothing else: no base URL, no dialect field, no format gate.
- A row reads two lines: the product title, then the name and the masked key tail.
- A row offers a check act, and the answer arrives as one of three verdicts worded as of the check.
- The pasted key trims at the contract boundary, and an interior control character refuses with a sentence about the key.
- A duplicate name under one provider refuses with the existing `name-conflict` code, before the vault write.
- The accounts document moves to version 3, carrying the tail as a non-secret field, so listing never opens the vault.
- The placeholder list retires, and the key surface takes the sibling's row anatomy.

**Non-goals:**

- No standing column and no stored verdict. A check's answer lives in the mutation that asked, and a remount forgets it.
- No replace-key act. Remove and reconnect is this round's remedy for a dead key.
- No custom endpoint connect. The entry stands inert until a base URL and a dialect have a home in the row.
- No check act on aggregator rows. OpenRouter rows render in the new anatomy and offer remove alone.
- No gateway pass-through. Nothing spends the key, and the engine's serving paths stay untouched.
- No reveal toggle on the key field. The field keeps its masked type.
- No new error codes. A rejected key is a verdict the person asked for, not a refusal.
- No vault re-architecture. The flat record, the codec, and the single writer all stay.

## Constraints and invariants

- TypeScript runs at maximum strictness: `strict: true` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, and `noPropertyAccessFromIndexSignature`.
- No `any`, no `as` casts to silence errors, and no `@ts-ignore` or `@ts-expect-error` without a comment explaining why.
- Never write code comments. Code explains itself through naming and structure. The sole exception is a constraint the code can't express.
- Feature-Sliced Design (FSD) v2.1 governs every renderer file. Every slice exports through its `index.ts` public interface.
- Main stays the single writer of `accounts.json` and the vault, per Architecture Decision Record (ADR) 0016.
- Secrets flow, never rest, outside the vault. After connect, a key crosses exactly one process boundary, from main to the engine child, in one structured-clone message.
- The `desktop-not-into-engine` wall stays at error severity, so main reaches the probe through the child protocol alone.
- Contracts stay pure: no vault read and no platform import, so a migration can't backfill what only the vault knows.
- Expected failures travel as typed results with context, never as thrown surprises.
- Test-first, always: red, green, refactor. Test code changes if and only if behavior changes. Doubles appear only at real process boundaries.
- Load-bearing derived types get `*.test-d.ts` specs with `expectTypeOf`, run through vitest typecheck.
- A new component under a `ui/` segment ships its `*.stories.tsx` sibling before the branch leaves the machine.
- Anything that reaches the screen gets looked at through `claude-in-chrome`, in both schemes, before it lands.
- Authored markdown passes Vale and cspell. Never use an em dash.
- `main` stays protected. One job, one branch, one pull request.

## Design

### The shape

Five pieces move together, from the inside out.

1. **Contracts** version the accounts document to 3, open the api-keys module, add the probe directive and the key-check report to the engine protocol, and register one channel.
2. **The engine** grows a provider probe: a pure fetch-injected module the child reaches through the new directive, plus sanitized refusal logging.
3. **Main** grows the check handler, a probe method on the engine host, and a connect that refuses duplicate names and mints the tail.
4. **The providers page** rebuilds the key surface: the seven awaited entries, the form that asks a name, and the key row in the sibling's anatomy, with the placeholder retiring.
5. **The records** move in step: the rewritten `README.md` line, the regenerated baselines, the cspell vocabulary, and ADR-0070.

### The key catalog

The catalog under the API Keys destination holds nine entries. `offeredUnder(catalogEntries, 'api-key')` already answers the two that connect, Anthropic API and OpenAI API, each naming its host in the benefit line. `awaitedFor('api-key')` answers empty today and gains the seven that don't: Gemini API, Mistral, xAI Grok, DeepSeek, Moonshot AI, Qwen, and Custom endpoint.

The awaited rows take the anatomy the subscription kind already ships: `aria-disabled`, the Soon badge, no click handler, and inertness that reads as more than color. Each benefit line names what the entry waits on. Six of the seven wait on a base URL with a dialect, and Gemini also waits on its own auth header. The row schema has no home for any of that, so the entries stand in the catalog rather than hide, and the copy says what the catalog grows toward.

### Connecting a key

Picking a connectable entry opens the key form inside the catalog sheet, as today, with two fields instead of one. The name starts empty and stays required, because two keys under one provider differ by purpose and the person names the purpose. The key field keeps its masked type. A refused connect keeps the draft, because a person who has pasted a key should never hunt for it twice.

A key whose shape suggests the other vendor draws a warning sentence under the field, and the connect still stands. The warning knows exactly one documented family, the Anthropic `sk-ant-` opening pasted under the OpenAI entry, because the OpenAI prefix inventory stays undocumented. A refusal here would repeat a shipped defect: a prefix gate rejected legitimate keys in openclaw#72121, so the form warns and never blocks.

On submit, the contract trims the key and refuses an interior control character before anything else runs. Main then refuses a name the same provider already holds, before the vault opens for writing, so a rejected connect leaves no orphan credential. A connect that stands mints the tail from the trimmed key, stores the secret in the vault, and appends the row with the tail riding as a non-secret field.

### The row

A key row reads two lines and no more. The first line carries the brand mark and the product title, `keyTitleFor` answering what the catalog card read as, Anthropic API or OpenAI API. The second line carries the name, then the tail drawn as four bullets and the four characters. A row stored before this change carries no tail, so its second line reads the name alone until the person reconnects the key.

Trailing on the row sit the check act and the overflow with Remove. The check act appears only where a check can mean something: rows whose kind is `api-key` and whose provider the probe knows. An aggregator row takes the same anatomy without the check act. A row whose stored provider the catalog doesn't know renders without a mark, falls back to the provider text, and offers remove alone.

### Checking a key

```
row                  main                        engine child          vendor
 |                     |                             |                    |
 |-- check {id} ------>|                             |                    |
 |                     |-- read row, open vault      |                    |
 |                     |   decrypt (in vault order)  |                    |
 |                     |-- probe {provider, key} --->|                    |
 |                     |   (one message, queue free) |-- GET /v1/models ->|
 |                     |                             |<-- status ---------|
 |                     |<-- key-check {verdict} -----|                    |
 |<-- verdict ---------|   (key left with the scope) |                    |
```

`accounts:check-key` names a row. Main reads the row, opens the vault, and decrypts the secret inside the vault queue, then releases the queue before anything leaves the process. The fetch never runs under the queue, so a slow vendor stalls no connect and no remove. Main hands the key to the engine child in one structured-clone directive, never in argv, never in an environment variable, and never on disk. The child holds the key in the probe call's function scope for the fetch's lifetime. Its answer has no field a key or a body could occupy.

The probe itself is a pure module the child composes with the platform fetch. It sends `GET /v1/models` with the vendor's own auth header, refuses redirects, and bounds the call with a timeout. The host's probe wait bound stands above the child's fetch bound, so the child's honest answer wins the race against the host giving up. Every path that fails to obtain a vendor status answers the same verdict. A dead child, a host timeout, and a refused directive all fold to could-not-check. Each folding logs a sanitized line in main naming what failed and carrying no key material.

### The verdicts

Three verdicts cover every outcome. A 2xx status authenticates: the key opened an authenticated read, and the copy claims nothing about spending. A 401 or 403 reads as not accepted, without guessing among typo, revoked, and expired, because the vendor's own code never says which. Everything else, including transport failure, a refused redirect, and a timeout, reads as could-not-check. The folding errs toward never overclaiming: a billing 402 isn't an invalid key, so it stays out of the not-accepted arm.

The screen words every verdict as of the check, never as current standing. The answer lives in the mutation that asked and a remount forgets it, so no stored sentence outlives its own truth.

### Trade-offs in view

The check opens the vault once per act, and carries that on purpose. The alternative was a mask computed from the vault at list time, which turns every list into a decrypt loop. The tail on the row makes listing free, and the explicit act makes each decrypt something the person asked for.

The design also accepts that a verdict evaporates. The sibling re-observes standing from local evidence on every list, and a key has no local evidence, only a remote answer that ages. Revocation propagates over minutes, live processes outlast deleted keys, and a stored verdict becomes a lie with no event to correct it. Forgetting is the honest cache policy.

## Data model and contracts

### The accounts document, version 3

`packages/contracts/src/accounts.ts` moves to version 3. The credentialed arm gains one optional field and nothing else changes shape.

```ts
export const ACCOUNTS_VERSION = 3;

const credentialedAccountSchema = z.strictObject({
  id: nonBlankString,
  provider: nonBlankString,
  kind: credentialedAccountKindSchema,
  label: z.string().trim().min(1),
  credentialRef: nonBlankString,
  keyTail: z.string().length(4).optional(),
});
```

The schema is strict, so a version 2 document carrying the field fails parse, and ADR-0062's one-version-one-shape rule forces the bump. The migration from 2 to 3 restamps the version and touches no row. It can't do more: contracts stay pure and never read the vault, so no migration can mint a tail for a stored secret. A pre-change row therefore carries no tail, and its second line reads the name alone.

### The api-keys module

`packages/contracts/src/api-keys.ts` opens as the shared vocabulary of checkable providers, pasted keys, and verdicts, mirroring `subscriptions.ts`.

```ts
export const keyProviderIdSchema = z.enum(['anthropic', 'openai']);

export const pastedKeySchema = z
  .string()
  .trim()
  .min(1)
  .refine(holdsNoControlCharacter, 'the key holds a control character');

export function keyTail(pasted: string): string | undefined;

export function vendorShapeOf(pasted: string): KeyProviderId | undefined;

export const keyCheckVerdictSchema = z.enum(['authenticates', 'not-accepted', 'could-not-check']);

export const keyCheckReportSchema = z.strictObject({
  verdict: keyCheckVerdictSchema,
  status: z.number().int().optional(),
});
```

`keyTail` answers the last four characters of the trimmed key, and nothing when the trim runs eight characters or fewer, so a short secret never publishes half of itself. `vendorShapeOf` answers the one documented family and stays silent otherwise, which is the warn-never-refuse rule made typed. `keyCheckReportSchema` is narrow on purpose: a verdict and an optional status code, with no field an upstream body could ride in.

### The engine protocol grows a probe

`packages/contracts/src/engine-protocol.ts` gains the third directive arm, and the report becomes a discriminated union.

```ts
export const engineDirectiveSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('start'), id: directiveIdSchema, gateway: engineGatewaySchema }),
  z.strictObject({ kind: z.literal('stop'), id: directiveIdSchema, slug: gatewaySlugSchema }),
  z.strictObject({
    kind: z.literal('probe'),
    id: directiveIdSchema,
    provider: keyProviderIdSchema,
    key: nonBlankString,
  }),
]);

export const engineReportSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('state'),
    answers: directiveIdSchema,
    slug: gatewaySlugSchema,
    state: gatewayEngineStateSchema,
  }),
  z.strictObject({
    kind: z.literal('key-check'),
    answers: directiveIdSchema,
    verdict: keyCheckVerdictSchema,
    status: z.number().int().optional(),
  }),
]);
```

The probe directive is the one place a key appears in any schema, and it travels parent port to child alone. The key-check report answers by directive id like a state report, and carries no slug, because a probe belongs to no gateway.

### The channel registry

`ipcChannels` grows from twenty entries to twenty-one. `IpcChannel`, `IpcRequest`, `IpcResponse`, and `RecomposeIpc` all derive from the map, so the type surface follows.

| Channel              | Request                  | Response                          |
| -------------------- | ------------------------ | --------------------------------- |
| `accounts:check-key` | `z.strictObject({ id })` | `ipcResult(keyCheckReportSchema)` |

`connectAccountRequestSchema` swaps `secret: nonBlankString` for `secret: pastedKeySchema`, which is where the trim and the control-character refusal live. Every caller passes the same boundary, so no second form can reintroduce the newline. `ipcErrorSchema` stays at eleven codes: the duplicate name reuses `name-conflict`, and a rejected key is a verdict rather than an error.

### Storage contracts

The vault doesn't change shape. `getSecret` gains its first production caller, the check handler, and the read-and-decrypt runs inside `inVaultOrder` while the fetch runs outside it. `accounts.json` stays the registry main owns. The connect's name refusal reads it inside the same queued turn that would write it, so two racing connects can't both take one name.

### The type-level specs

`ipc.test-d.ts` moves its totality assertion to twenty-one channels and keeps the error codes at eleven members. `accounts.test-d.ts` pins that the credentialed arm's `keyTail` is optional and that no account arm carries a `secret` or `key` property. `engine-protocol` gains a type spec pinning that the report union discriminates on `kind` and that the key-check arm carries no field beyond the verdict, the status, and the id it answers.

## Error handling

| Failure                                            | Representation                                             | The screen shows                                                |
| -------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| The pasted key is blank after the trim             | `ok: false`, `validation-failed`, at the contract boundary | the form's refusal sentence, draft kept                         |
| The key holds an interior control character        | `ok: false`, `validation-failed`, message about the key    | the form's refusal sentence, draft kept                         |
| The name stands under the same provider            | `ok: false`, `name-conflict`, message names the holder     | the form's refusal sentence, before any vault write             |
| The key's shape suggests the other vendor          | not a failure                                              | the warning sentence under the field, and Connect stays live    |
| The vendor answers 401 or 403 to the probe         | `verdict: 'not-accepted'`, not an error                    | the not-accepted sentence, worded as of the check               |
| The vendor is unreachable, redirects, or times out | `verdict: 'could-not-check'`                               | the could-not-check sentence, with connect and remove untouched |
| The engine child dies or the host wait runs out    | `verdict: 'could-not-check'`, logged in main with context  | the same sentence, because the person's remedy is the same      |
| The child refuses a malformed probe directive      | sanitized log, paths and codes only, never received values | nothing, and the host wait folds to could-not-check             |
| The checked row or its vault entry is missing      | `ok: false`, `validation-failed` or `storage-failed`       | the standard refusal path naming the operation                  |
| A malformed request crosses the bridge             | `ok: false`, `validation-failed`                           | the standard refusal path                                       |
| A version 3 document meets an older build          | the stepper refuses a newer schema                         | the stored file survives untouched, reported rather than eaten  |

Three rules bind the handlers. No silent failures: every path that folds to could-not-check logs what failed in main, with the provider and the operation named. No upstream byte survives: the probe never reads the response body, so no vendor sentence can reach a message or the screen. Expected failures travel as typed values: a dead key is a verdict, because it describes the key rather than refusing the act.

## File map

### Contracts

- `packages/contracts/src/accounts.ts`: version 3, the optional `keyTail`, and the pass-through migration (modify)
- `packages/contracts/src/accounts.test.ts`: the tail's admission and refusal, and the migration behavior (modify)
- `packages/contracts/src/accounts.test-d.ts`: the tail's optionality and the no-secret-property pin (modify)
- `packages/contracts/src/api-keys.ts`: provider ids, the pasted-key schema, the tail, the shape hint, and the verdicts, mirroring `subscriptions.ts` (create)
- `packages/contracts/src/api-keys.test.ts`: schema and helper behavior specs with fast-check properties (create)
- `packages/contracts/src/engine-protocol.ts`: the probe arm and the report union (modify)
- `packages/contracts/src/engine-protocol.test.ts`: the union's admission and refusal (modify)
- `packages/contracts/src/ipc.ts`: the channel and the narrowed secret field (modify)
- `packages/contracts/src/ipc.test.ts`: the roster moves to twenty-one (modify)
- `packages/contracts/src/ipc.test-d.ts`: totality over twenty-one channels (modify)
- `packages/contracts/src/index.ts`: re-exports the api-keys module (modify)

### Engine

- `packages/engine/src/provider/key-probe.ts`: the pure fetch-injected probe, vendor headers, refused redirects, the fetch bound, and the status folding, mirroring `gateway-app.ts` in style (create)
- `packages/engine/src/provider/key-probe.test.ts`: the folding table, the never-overclaim property, and the injected-fetch doubles (create)
- `packages/engine/src/engine-child.ts`: the probe dispatch and the sanitized refusal log, paths and codes without received values (modify)
- `packages/engine/src/engine-child.test.ts`: the probe round trip over the fake parent port (modify)
- `packages/engine/src/engine-child-pipe-hygiene.test.ts`: forks a real child process, feeds it a malformed probe carrying a marker secret, and asserts both pipes stay clean (create)
- `packages/engine/src/testing/hygiene-child.mts`: the forked entry wiring `attachEngineChild` to a port fed from the test (create)

### Main process

- `apps/desktop/src/main/engine-host/engine-host.ts`: the `probe` method, report routing by kind, and the probe wait bound above the child's fetch bound (modify)
- `apps/desktop/src/main/engine-host/engine-host.test.ts`: probe answers, child-death folding, and the bound relation (modify)
- `apps/desktop/src/main/ipc/key-check-ipc.ts`: the check handler, read-and-decrypt inside the vault queue and the probe outside it, mirroring `subscriptions-ipc.ts` (create)
- `apps/desktop/src/main/ipc/key-check-ipc.test.ts`: handler specs against temp storage and a scripted child (create)
- `apps/desktop/src/main/ipc/storage-ipc.ts`: the per-provider name refusal before the vault write, and the tail mint on connect (modify)
- `apps/desktop/src/main/ipc/storage-ipc.test.ts`: the refusal ordering and the tail's presence on the stored row (modify)
- `apps/desktop/src/main/ipc/storage-ipc-secret-hygiene.test.ts`: no check response, no connect response, and no console line carries key material (modify)
- `apps/desktop/src/main/storage/accounts-store.test.ts`: its stored fixture moves to version 3 (modify)
- `apps/desktop/src/main/ipc/dispatch.ts`: `ipcChannelNames` gains the entry (modify)
- `apps/desktop/src/main/ipc/dispatch.test.ts`: the totality assertion follows (modify)
- `apps/desktop/src/main/index.ts`: composes the check handler over the engine host (modify)
- `apps/desktop/src/preload/index.ts`: one bridge entry (modify)

### Renderer

- `apps/desktop/src/renderer/src/pages/providers/model/provider-catalog.ts`: the seven awaited key entries and `keyTitleFor` (modify)
- `apps/desktop/src/renderer/src/pages/providers/model/provider-catalog.test.ts`: the awaited list and the title fallback (modify)
- `apps/desktop/src/renderer/src/pages/providers/ui/key-account-row.tsx`: the two-line row with the tail, the check act, and the overflow, mirroring `subscription-account-row.tsx` (create)
- `apps/desktop/src/renderer/src/pages/providers/ui/key-account-row.stories.tsx` and `key-account-row.browser.test.tsx`: siblings, including the no-tail and unknown-provider rows (create)
- `apps/desktop/src/renderer/src/pages/providers/ui/connect-key-form.tsx`: the name field and the foreign-shape warning (modify)
- `apps/desktop/src/renderer/src/pages/providers/ui/connect-key-form.stories.tsx` and `connect-key-form.browser.test.tsx`: follow (modify)
- `apps/desktop/src/renderer/src/pages/providers/ui/credentialed-surface.tsx`: renders the key rows in place of the placeholder (modify)
- `apps/desktop/src/renderer/src/pages/providers/ui/account-list.tsx` and `account-list.stories.tsx`: retire (delete)
- `apps/desktop/src/renderer/src/pages/providers/ui/providers-page.browser.test.tsx`: the key surface's screen-level behavior (modify)
- `apps/desktop/src/renderer/src/shared/api/accounts.ts`: `useCheckKey()`, with no invalidation because nothing stored changes (modify)
- `apps/desktop/src/renderer/src/shared/testing/fake-bridge.ts`: the check stub with a scripted verdict seed (modify)

### End to end, records, and repository files

- `apps/desktop/e2e/features/providers/`: the approved features from this change's `gherkin/` folder, rewriting `accounts.feature`'s two scenarios (create and modify)
- `apps/desktop/e2e/steps/providers.steps.ts` and `apps/desktop/e2e/provider-screen.ts`: the name field, the row lines, the check act, and the verdict sentences by role and name (modify)
- `apps/desktop/e2e/fixtures.ts`: the probe-origin override, a loopback stub serving both vendors' `/v1/models` with scripted statuses, handed through `RECOMPOSE_PROBE_ORIGIN` beside the existing launcher and keychain overrides (modify)
- `apps/desktop/e2e/visual.spec.ts-snapshots/`: providers-connected regenerates on all three platforms (modify)
- `README.md`: the endpoint bullet stops promising a base URL and names the two first-party keys (modify)
- `cspell-words.txt`: DeepSeek, Gemini, Grok, Mistral, Moonshot, xAI, litellm, and openclaw, the vocabulary this change's artifacts and diff introduce (modify)
- `docs/adr/0070-key-checks-live-in-the-engine-child.md` and `docs/adr/README.md`: land at implementation from the draft below (create)

The engine's Stryker gate mutates `key-probe.ts` and the child dispatch as ordinary logic. The forked hygiene entry is a `.mts` testkit outside the mutate glob, so no exclude line lands. The desktop gate reaches the check handler, the name refusal, and the tail mint unchanged.

## Interfaces

### Contracts

- Consumes: `zod`, `nonBlankString`, `ipcResult`, and the migration stepper.
- Produces:
  - `ACCOUNTS_VERSION` at 3 and the credentialed arm's optional `keyTail`
  - `keyProviderIdSchema`, `KeyProviderId`, `pastedKeySchema`, `keyTail()`, and `vendorShapeOf()`
  - `keyCheckVerdictSchema`, `keyCheckReportSchema`, and `KeyCheckReport`
  - the probe directive arm, the report union, and `IpcChannel` widened to twenty-one members

### Engine

- Consumes: the contracts surface and the platform `fetch` through injection.
- Produces:
  - `probeKey(fetchLike: typeof fetch, provider: KeyProviderId, key: string): Promise<KeyCheckReport>`
  - the child's probe dispatch, holding the key in the call's scope and posting the key-check report
  - the probe-origin substitution the child composes from its environment, defaulting to the vendors' first-party hosts

### Main

- Consumes: the contracts surface, the engine host, and the storage stores.
- Produces:
  - `probe(provider: KeyProviderId, key: string): Promise<KeyCheckReport>` on `EngineHost`, folding every non-answer to could-not-check
  - `createKeyCheckIpcHandlers(ctx): Pick<IpcHandlers, 'accounts:check-key'>`
  - the connect that refuses a held name per provider and mints the tail

### Renderer

- Consumes: the twenty-one-channel bridge, `unwrapIpcResult`, `refusalSentence`, and the kit.
- Produces:
  - `shared/api`: `useCheckKey()` beside the existing account hooks
  - `pages/providers`: `KeyAccountRow`, the two-field `ConnectKeyForm`, and `keyTitleFor`, all through the slice's public interface

## Decisions

### 1. The mask is the last four characters, no vendor prefix, minted in main at connect time

Main computes the tail from the trimmed key inside the connect, and the row stores it as a non-secret field, so listing accounts never opens the vault. The tail is four characters because no standard governs mask length for keys. The figure traces to payment-card masking, whose guidance calls the maximum a ceiling rather than a default. Four is the smallest tail that still matches a row to a console entry. This deviates from the design system document, which draws `sk-ant-••••7f2c`. The row's first line already names the vendor, so publishing the prefix would publish the key class for nothing.

**Alternatives considered:** computing the mask at list time from the vault, rejected because it turns every list into a decrypt loop. Storing prefix plus tail per the design document, rejected because the prefix duplicates the first line and advertises the key class. A longer tail, rejected because no standard asks for it and every extra character narrows the secret.

**ADR draft:** carried inside draft 3, which owns the custody posture.

### 2. The tail rides the accounts document at version 3, and pre-change rows show their name alone

`credentialedAccountSchema` is strict, so the new field fails a version 2 parse, and ADR-0062's rule makes the bump mandatory: one version names one shape. The migration from 2 to 3 restamps the version and rewrites nothing, and that emptiness is the point rather than a shortcut. Contracts stay pure and can't read the vault, so no migration can mint a tail for a secret it can't see. A pre-change row carries no tail, its second line reads the name alone, and reconnecting the key mints one.

**Alternatives considered:** loosening the schema so the field rides without a bump, rejected because strictness is the guard that keeps a secret-shaped field from ever landing unnoticed. Backfilling tails from main at startup, rejected because it adds a second writer path and a vault read to buy a cosmetic field.

**ADR draft:** None. ADR-0062 already owns the rule, and this follows it.

### 3. Key checks live in the engine child, behind the wall

This is the change's architectural decision, and it lands as ADR-0070. The draft follows.

**Context.** The `desktop-not-into-engine` rule in `.dependency-cruiser.cjs` walls main off from `packages/engine` at error severity, and the engine already knows both vendors' path families in `gateway-app.ts`. A stored key needs a way to answer "does this still work" without recompose spending it. The defect record binds the transport. Rider #118 is a credential blob riding argv, the recorded 401 bodies can carry key material, and prefix gates rejected legitimate keys in openclaw#72121.

**Decision.** Verification is a probe the engine child runs. The probe is a pure fetch-injected module under `packages/engine/src/provider/`, reached through a new `probe` directive on the existing parent-port protocol. Main reads the row, opens the vault, and decrypts inside the vault queue. It then hands the key to the child in one structured-clone directive message: never argv, never an environment variable, never disk. The child holds the key in the probe call's function scope for the fetch's lifetime. Its report carries a verdict and an optional status code, with no field a body could occupy. The probe sends `GET /v1/models` with the vendor's own header, refuses redirects, and bounds the call. Main folds every failure to obtain a vendor status into the could-not-check verdict.

**Alternatives.** Fetching from main, rejected: it either duplicates vendor dialect knowledge across the wall or tears the wall down, and the wall is the architecture. Verifying in the renderer, impossible: the sandbox has no vendor reach, and a key must never cross the bridge. A separate verification child, rejected: a second process for one bounded call, when the resident child already speaks a directive protocol. Passing the key through argv or the environment, rejected: argv is the exact defect class rider #118 records. An environment variable lingers on the process object for every library to read.

**Consequences.** **Good**: dialect knowledge keeps one home, the key crosses one boundary in one message, and the report schema can't smuggle an upstream byte. **Bad**: a probe on a machine running no gateway spawns the resident child. The check path now depends on the child's health, so a dead child reads as could-not-check rather than as an error the person can act on. The parent-port protocol carries a secret for the first time, which makes the child's log pipes a hygiene surface and adds the sanitized refusal rule below.

**ADR draft:** `docs/adr/0070-key-checks-live-in-the-engine-child.md`, from the text above.

### 4. The key crosses to the child in one structured-clone message, and nowhere else

Custody is one sentence: main decrypts, one directive carries the key, and the child's function scope is the key's whole life outside the vault. The report schema carries a verdict and an optional status code, so no code path can echo the key or an upstream body back. The child's refusal log sanitizes to issue paths and codes, never received values, because a refused probe directive is the one log line that could carry a rejected key.

**Alternatives considered:** argv, rejected as rider #118's defect class, visible to any process listing. An environment variable on the child, rejected because it rests on the process object beyond the call. A temp file with a path in the directive, rejected because a secret at rest outside the vault breaks the resting rule.

**ADR draft:** carried inside draft 3.

### 5. The probe is `GET /v1/models` on both vendors, and every status folds to one of three verdicts

Both vendors offer the models list as a body-less authenticated read, so one symmetric probe serves both dialects and pins no model id that ages. Anthropic's token-counting endpoint is also free, and demands a model id in its body, which is exactly the aging pin the models list avoids. The folding stands fixed: 2xx authenticates, 401 and 403 read as not accepted, and everything else, transport failure and refused redirects included, reads as could-not-check. The table errs toward never overclaiming: a 402 is a billing fact, not a key fact, so it never reads as rejected.

**Alternatives considered:** a minimal completion request, rejected because it spends money to ask a yes-or-no question and pins a model id. A per-vendor validation endpoint, rejected because neither vendor documents one. Treating every non-2xx as rejection, rejected because it overclaims on outages and rate limits, and the not-accepted sentence would lie.

**ADR draft:** carried inside draft 3.

### 6. A verdict is mutation state, worded as of the check, and never stored

The check's answer lives in the renderer mutation that asked, the copy speaks as of the check's moment, and a remount forgets it. Revocation propagates over minutes at the vendors, a live process outlasts a deleted key, and Anthropic keys now expire on a schedule no client can read. A stored verdict therefore becomes a lie with no event to correct it. This deviates from the sibling on purpose: subscription standing re-observes from local evidence on every list, and a key has no local evidence, only a remote answer that ages. No standing column and no replace-key act land this round.

**Alternatives considered:** a stored last-check column with its timestamp, rejected because the row would assert freshness the vendor can revoke at any moment. Re-probing every list, rejected because it turns listing into vendor traffic and every list into a vault read, which decision 1 exists to prevent.

**ADR draft:** carried inside draft 3.

### 7. A duplicate name refuses per provider, with the existing code, before the vault write

Connect refuses a name the same provider already holds, answering `name-conflict` with the holder named, in the wording pattern the gateway refusal already ships. The check runs before the vault opens for writing, so a rejected connect leaves no orphan credential. Uniqueness scopes to the provider rather than to the whole list, because scoping wider shipped as a defect elsewhere: litellm#8328 records one user's alias blocking another's. Two rows under different providers may share a name, because the first line already tells them apart.

**Alternatives considered:** global uniqueness, rejected because the same person reasonably names a key "Work" under each provider, and each stays unambiguous there. No check at all, rejected because the ambiguity lands on the destructive act: removing the wrong twin loses a vault entry no vendor can restore.

**ADR draft:** None. The refusal reuses a shipped code and a shipped wording pattern.

### 8. The contract trims, refuses interior control characters, and a foreign-shaped key warns and still connects

`pastedKeySchema` trims the pasted key and refuses an interior control character, at the contract boundary every caller passes. Today `secret: nonBlankString` never trims, so a trailing newline reaches the vault and every later request dies in header building with nothing on screen to explain it. The refusal covers only characters that can never be legal in a header, so it gates no legitimate key. A key whose shape suggests the other vendor draws a warning and must still connect, because the prefix gate is a shipped defect. The record, openclaw#72121, shows legitimate keys rejected by their own vendor's gate, and vendors mint new families without notice.

**Alternatives considered:** trimming in the form, rejected because the contract is the boundary and a second caller would reintroduce the newline. A format or prefix gate, rejected on the defect record and on research finding 5: no vendor documents a stable inventory to gate against. Warning on every unrecognized shape, rejected because the vendors document only one family, so every other warning would guess.

**ADR draft:** None. The decision applies the acceptance brief's criteria directly.

## Test matrix

| Layer          | What this layer proves (or why none)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Check command                                                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit           | In contracts: the pasted key trims and refuses control characters, the tail derives from the trim with the short-key cutoff, the shape hint knows one family, the migration restamps and touches no row, and both protocol unions admit and refuse the right arms. In the engine: the folding table over an injected fetch, including thrown fetches and refused redirects. In the renderer: the catalog's awaited seven, the title fallback, the two-field form with its warning, and the row's lines over the fake bridge. | `pnpm run test`                                                                                                                                                       |
| Integration    | The handlers against real temp storage: connect refuses a held name before the vault write, mints the tail, and stores the trimmed secret. The check reads and decrypts inside the queue, probes through a scripted child, and answers each verdict. A dead child and a host timeout fold to could-not-check. Dispatch registers all twenty-one channels, and no response or console line carries key material. The pipe-hygiene spec feeds a real forked child a malformed probe and both pipes stay clean.                 | `pnpm run test`                                                                                                                                                       |
| End-to-end     | In the real shell with the probe origin pointed at the loopback stub: the approved features run. The catalog shows nine entries with seven inert under Soon, connecting asks a name and a key, the row reads its two lines with the tail, a duplicate name refuses, a foreign shape warns and connects, each verdict sentence appears as of the check, and remove empties the screen.                                                                                                                                        | `pnpm run test:e2e` and `pnpm --filter @recompose/desktop run test:e2e:visual`                                                                                        |
| Property       | Any version 2 document migrates to a valid version 3 document with every row byte-identical. For any string, the tail is either absent or exactly the trim's last four characters, and never present for trims of eight or fewer. For any padded string, the parsed secret equals its trim. For any integer status, the folding answers exactly one verdict and answers authenticates only on 2xx. The stringified check response never contains any window of the key.                                                      | `pnpm run test`                                                                                                                                                       |
| Mutation scope | Three diff-scoped gates. The contracts gate mutates the accounts and api-keys modules and the protocol at break 77. The engine gate mutates the probe and the child dispatch at break 80. The desktop gate mutates the check handler, the name refusal, and the tail mint at break 81. The gate doesn't reach the renderer, so the row, the form, and the catalog rest on the browser and property layers instead.                                                                                                           | `pnpm --filter @recompose/contracts run test:mutation`, `pnpm --filter @recompose/engine run test:mutation`, and `pnpm --filter @recompose/desktop run test:mutation` |

### Designated mutant killers

| Invariant                                             | Mutant killer                                                   |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| The migration touches no row                          | the byte-identical round-trip property in `accounts.test.ts`    |
| The tail derives from the trim and never exceeds four | the tail properties in `api-keys.test.ts`                       |
| The folding never overclaims                          | the one-verdict-per-status property in `key-probe.test.ts`      |
| The name refusal lands before the vault write         | the untouched-vault-after-refusal spec in `storage-ipc.test.ts` |
| No response or log carries key material               | the windowed hygiene spec and the forked pipe spec              |
| A non-answer folds to could-not-check                 | the child-death and timeout examples in `engine-host.test.ts`   |

## Task decomposition hooks

Tasks run in parallel by default. A dispatch serializes only for a named blocker: one task reads what another produces, two tasks own the same file, or one inspects what another writes. Every dispatch names its files and states that the others run on disjoint files.

- Task 1: contracts (depends on: none, hands off: version 3, the api-keys module, the protocol union, and the twenty-one-channel surface). Owns `packages/contracts/src/`.
- Task 2: the engine probe (depends on: task 1, reads its schemas, hands off: the probe module, the child dispatch, and the pipe hygiene). Owns `packages/engine/src/`. Runs beside tasks 3 and 4 on disjoint files.
- Task 3: main (depends on: task 1, with the scripted child standing in for task 2's real one, hands off: the check handler, the host probe, and the guarded connect). Owns the engine-host files, the handler and dispatch files, `apps/desktop/src/main/index.ts`, and the preload touch.
- Task 4: the renderer surface (depends on: task 1 for types, hands off: the key surface over the fake bridge, with the placeholder deleted). Owns `pages/providers/`, `shared/api/accounts.ts`, and `shared/testing/fake-bridge.ts`.
- Task 5: acceptance and records (depends on: tasks 2, 3, and 4, because it inspects the running app they produce, hands off: the merged branch evidence). Owns `apps/desktop/e2e/`, the visual baselines, `README.md`, `cspell-words.txt`, and ADR-0070 with its index row.

## Risks

- [Risk] The child's log pipes reach main's console → `spawn-engine` forwards both pipes, and the child logs refusal issues that can carry rejected input, which on the probe path is a key. Mitigation: the refusal log sanitizes to issue paths and codes, and the hygiene spec forks a real child, feeds it a malformed probe with a marker secret, and asserts both pipes stay clean. Unmitigated: the pipes stay forwarded, so a future child log line ships to main's console, and the spec pins the refusal path alone.
- [Risk] A key verifies and then dies → revocation propagates over minutes, and a live process outlasts a deleted key. Mitigation: every verdict sentence speaks as of the check, nothing stores a verdict, and a remount forgets. Unmitigated: a person can still read a fresh green sentence as now.
- [Risk] The seven inert entries read as broken rather than awaited → Mitigation: the Soon badge, the honest benefit line naming what each waits on, and the `aria-disabled` anatomy the subscription kind already ships, with an e2e step asserting the inertness reads as more than color. Unmitigated: the person who wants Gemini today still leaves without it.
- [Risk] The vault opens on a path that lists rows → Mitigation: the tail rides the row, listing never opens the vault, and only the explicit check act decrypts, one secret per act, with the hygiene spec asserting the list path performs no vault read. Unmitigated: each check still decrypts one secret into memory for the fetch's lifetime.
- [Risk] A slow vendor stalls connect and remove → Mitigation: the fetch runs outside the vault queue, so the queue holds only the read-and-decrypt.
- [Risk] Two connects race one name → Mitigation: the vault queue serializes connects, and the refusal reads the registry inside the same queued turn that writes it.
- [Risk] The host wait bound and the child fetch bound invert → Mitigation: the relation stands in one spec, host above child, so the child's honest could-not-check always wins the race.
- [Risk] The foreign-shape warning rots as vendors mint new families → Mitigation: the warning knows one documented family and warns rather than refuses, so a wrong silence costs one not-accepted verdict instead of a rejected legitimate key.
- [Risk] A check on a machine running no gateway spawns the resident child → Mitigation: the child stays resident by design and the probe reuses its lifecycle. Unmitigated: one utility process stands where none ran.

## Migration and rollout

**Deploy.** One release carries the whole change, nothing behind a flag. No release of recompose has shipped, so the population of stored documents is developer machines.

**The accounts document moves to version 3.** The migration restamps the version and touches no row, and a fast-check property proves every row survives byte-identical. The bump is mandatory rather than ceremonial: the strict schema refuses the tail at version 2, and ADR-0062 names one shape per version. Pre-change rows carry no tail, read their name alone, and mint one on reconnect.

**Rollback.** A checkout from before this change refuses a version 3 document as newer than supported, which the stepper already does. The storage layer reports the refusal rather than repairing anything, and the file survives untouched.

**What retires.** The placeholder `account-list.tsx` and its stories leave. The key form stops naming the account itself. The two scenarios in `accounts.feature` rewrite around the two-field form and the two-line row, and the providers-connected baseline regenerates on all three platforms.

**Records that move in step.** The `README.md` endpoint bullet stops promising a base URL and names the two first-party keys. ADR-0070 lands from the draft in decision 3, with its index row. The new vendor vocabulary joins `cspell-words.txt` in the same diff that uses it.

## Open questions

- **The exact copy of the three verdict sentences.** The verdicts and their as-of-the-check framing stand fixed. The words pass through the writing-guidelines skill at implementation without moving any boundary.
- **The two timeout figures.** The relation stands fixed, the host's probe wait above the child's fetch bound. The numbers settle in one spec during implementation.
- **Whether one stub origin serves both vendors in the e2e suite.** The seam's shape holds either way: the origin substitutes through the environment, and the key still travels only in the directive.

## End-to-end verification

Run the desktop app from `apps/desktop` with `pnpm dev`, then walk the loop.

1. The sidebar's API Keys destination opens the kind-scoped screen: the heading, the subtitle about keys a gateway spends request by request, and the empty state explaining what a key is.
2. Add provider opens the catalog holding nine entries. Anthropic API and OpenAI API answer the pointer, and the seven others stand inert under Soon badges with benefit lines naming what each waits on.
3. Picking Anthropic API opens the form asking a name and a key, and nothing else. The card behind it named the host the key will reach.
4. Pasting a key with a trailing newline and the name "Work" connects. The row reads Anthropic API over "Work" and a four-character tail, and the tail matches the key's last four characters without the newline.
5. Connecting a second Anthropic key named "Work" refuses with the holder named, and the vault holds no orphan. The same name under OpenAI API connects.
6. Pasting an `sk-ant-` key under OpenAI API draws the warning sentence, and Connect still stands.
7. Check key on a live key answers the authenticates sentence, worded as of the check. Leaving the screen and returning shows no verdict anywhere.
8. Check key on a revoked key answers the not-accepted sentence. With the network cut, the same act answers the could-not-check sentence, and connect and remove keep working throughout.
9. Remove deletes the row and its vault entry. A seeded version 2 document lists its old rows with the name alone on the second line.
10. Both schemes get the `claude-in-chrome` pass: the tail's contrast on the second line, the Soon badges, the warning sentence, and the inert entries measured from the page.

A fresh-context reviewer diffs the result against these criteria:

- `accountsDocumentSchema` sits at version 3 with the optional tail, the pass-through migration, and the `accounts.test-d.ts` pins.
- `ipcChannels` holds twenty-one entries, `ipcChannelNames` matches, the preload bridge matches, and the error codes stay at eleven.
- The key reaches the child in one structured-clone directive, and no argv, environment, or disk path carries it, with the hygiene and pipe specs asserting both pipes and every response stay clean.
- `pnpm run lint:deps` stays green: main still never imports `packages/engine`.
- The list path performs no vault read, and only `accounts:check-key` calls `getSecret`.
- The placeholder leaves the tree, every new `ui/` component ships its stories, and `pnpm run lint:stories` and `pnpm run lint:fsd` pass.
- The approved features pass against the loopback stub, the baseline regenerates on three platforms, and the `README.md` bullet matches what ships.
- ADR-0070 lands from the draft in decision 3, and the index carries its row.
