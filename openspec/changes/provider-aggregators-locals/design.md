# Provider-aggregators-locals design

## Header and change linkage

- Change id: provider-aggregators-locals
- Schema: recompose
- Proposal: [proposal.md](proposal.md)
- Specs: [specs/aggregators/spec.md](specs/aggregators/spec.md), [specs/local-runtimes/spec.md](specs/local-runtimes/spec.md)
- Discovery: [discovery/code-map.md](discovery/code-map.md), [discovery/technical-research.md](discovery/technical-research.md), [discovery/acceptance-references.md](discovery/acceptance-references.md), [discovery/rider-ledger.md](discovery/rider-ledger.md), [discovery/mobbin-references.md](discovery/mobbin-references.md)
- Tasks: [tasks.md](tasks.md)

## Context

The providers screen promises four destinations, and two keep the promise. Aggregators already connects OpenRouter through the key machinery, yet its catalog stands alone, its subtitle overpromises, and its mark is a boxed letter. Local Runtimes routes to a placeholder note, and the accounts document refuses to store a local row at all.

Each destination breaks one shipped record. Architecture Decision Record (ADR) 0070 proves a key against one first-party host, and an aggregator's key reaches many hosts through a catalog OpenRouter serves without authentication. A models probe would bless a garbage key, so the honest aggregator row offers no check. ADR 0069 gives only the credentialed kinds a `credentialRef`, and a local runtime holds no credential, only an address that answers or doesn't. Each break gets its own contract rather than a quiet exception.

The design turns the locked proposal into contracts, files, tests, and task boundaries. It versions the accounts document for the credential-free arm and teaches the engine child a reachability probe. It builds the detect-then-add flow and the local surface, fills both awaited lists, and rebuilds the brand marks over a real icon set.

## Discovery inputs consumed

- Code map, `provider-catalog.ts` entry: `ConnectionWay` excludes `local` by construction and `awaitedFor('aggregator')` answers empty, so the type widens and both awaited lists land there.
- Code map, `catalog-flow.tsx` entry: `connectStepFor` dead-ends a local pick, so the detect step wires in behind that fork.
- Code map, `catalog-list.tsx` entry: the `local` special case renders awaited rows only, so it deletes once Ollama joins `catalogEntries`.
- Code map, `connect-account.ts` entry: every connect mints a `credentialRef` and writes the vault, so the local add gets its own channel instead of a branch inside it.
- Code map, `brand-mark.tsx` entry: the mark set holds three names and lends `CatalogEntry.id` its type, so the identity type decouples before the set widens.
- Code map, `key-account-row.tsx` entry: `checkableKey` already withholds Verify from an aggregator row, so the spec's absence requirement needs proof, not code.
- Code map, `vault.ts` entry: named as the boundary the local path must never cross, which decision 1 makes structural.
- Research finding 3, reachability rather than validity: `GET /api/version` becomes the probe, so an empty model library never reads as a failure.
- Research finding 3, the token-optional local kind: consulted, and the proposal binds harder. The local arm holds no credential field at all, so the parse-error gate survives whole.
- Research finding 8, well-known ports and never a scan: the probe only ever calls the one documented address.
- Acceptance A1, the public catalog: a models probe can't prove an aggregator key, which is the load-bearing fact behind ADR 0073.
- Acceptance A2 and C1, the widened verdict vocabulary: consulted, not adopted. The proposal scopes the aggregator check out entirely rather than widening ADR 0070's triad for one vendor.
- Acceptance B2, never store `localhost`: main mints `http://127.0.0.1:11434` from a contracts-owned table, and no field accepts another host.
- Acceptance B3, base-URL normalization defects: consulted, no impact. No editable base URL exists, so the defect class has nothing to land on.
- Acceptance B4, "not running" as an expected state: the silence face names the runtime, the address, and the remedy.
- Acceptance C2, never store a verdict, harder for locals: the row re-reads its standing on every mount and the registry keeps nothing.
- Acceptance C3, the probe as a server-side request forgery control: the loopback-only address schema enforces the aim at contract parse.
- Mobbin, Rox: detection runs as its own step before the add, which is the detect step's grammar.
- Mobbin, Twingate and n8n: a standing reads as a dot beside a word, and a liveness reading pairs with a version string.
- Mobbin, all three aggregator references: none offers a check on an aggregator row, so the absence ships what the field already ships.
- Rider ledger, #118: the vitest and Stryker exclusion lists must shrink rather than grow, so the local main-side code stays inside both mutate globs.
- Rider ledger, #123: no activation act lands, so `subscriptions:activate` stays surfaceless on purpose.
- Rider ledger, #117: no composition surface lands, and neither kind becomes routable here.
- Rider ledger, #122: consulted as a seam precedent. The runtime stub lands beside `key-probe-stub.ts`, not under `fake-tools/`.

## Goals and non-goals

**Goals:**

- The Aggregators catalog offers seven entries: OpenRouter connects, and six stand inert under Soon badges with honest benefit lines.
- An aggregator row reads the two-line key anatomy and offers no Verify act anywhere on or behind it.
- The aggregator subtitle becomes the design's own sentence, and the OpenRouter key field hints its documented shape.
- The Local Runtimes catalog offers five entries: Ollama connects, and four stand inert under Soon badges.
- Picking Ollama detects on entry at the documented address, reports what it found, and stores nothing until the person decides.
- A local account stores as its own credential-free union arm, at accounts version 4, with the address main mints.
- A local row reads the runtime over its address and observes its standing on every look, through three reachability verdicts the registry never keeps.
- Every vendor entry draws its real mark from `@lobehub/icons`, categories keep the network glyph, and the letter monogram retires.

**Non-goals:**

- No editable base URLs. Main mints the one documented address, and no field accepts another.
- No optional tokens. A local row can't hold a credential, and no form asks for one.
- No model enumeration and no pickers. A row says the server answers, never what it serves.
- No gateway routing targets. Neither kind becomes routable here, so composition stays a later change.
- No stored standing. A reading dies with the screen, so no row carries a stale claim.
- No aggregator check of any shape. The credential-scoped endpoint waits for a surface that can hold its spend data.
- No port sweep. The probe only ever calls the one documented address.
- No widening of the key-check verdict triad. The reachability verdicts are their own union, and ADR 0070 stands unchanged.

## Constraints and invariants

- TypeScript runs at maximum strictness: `strict: true` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, and `noPropertyAccessFromIndexSignature`.
- No `any`, no `as` casts to silence errors, and no `@ts-ignore` or `@ts-expect-error` without a comment explaining why.
- Never write code comments. Code explains itself through naming and structure. The sole exception is a constraint the code can't express.
- Feature-Sliced Design (FSD) v2.1 governs every renderer file. Every slice exports through its `index.ts` public interface.
- Main stays the single writer of `accounts.json` and the vault, per ADR 0016.
- The local path never opens, touches, or imports the vault. No schema on the local path carries a secret-shaped field.
- The `desktop-not-into-engine` wall stays at error severity, so main reaches both probes through the child protocol alone.
- Contracts stay pure: no platform import and no vault read, so a migration rewrites only what the document itself holds.
- Expected failures travel as typed results with context, never as thrown surprises.
- Test-first, always: red, green, refactor. Test code changes if and only if behavior changes. Doubles appear only at real process boundaries.
- Load-bearing derived types get `*.test-d.ts` specs with `expectTypeOf`, run through vitest typecheck.
- A new component under a `ui/` segment ships its `*.stories.tsx` sibling before the branch leaves the machine.
- Anything that reaches the screen gets looked at through `claude-in-chrome`, in both schemes, before it lands.
- Authored markdown passes Vale and cspell. Never use an em dash.
- `main` stays protected. One job, one branch, one pull request.

## Design

### The shape

Six pieces move together, and the first moves alone.

1. **Contracts** version the accounts document to 4 with the `local` arm, open the local-runtimes module, widen the key-shape recognizer, add the runtime directive to the engine protocol, and register three channels. This commit lands first and alone, because nothing may mint a local row before the schema that admits one exists.
2. **The engine** grows a runtime probe beside the key probe: a pure fetch-injected module the child reaches through a new parent-port directive.
3. **Main** grows the three local handlers, a runtime probe method on the engine host, and a remove that knows a local row releases nothing.
4. **The catalog and the marks** move Ollama into `catalogEntries`, fill both awaited lists, teach the key field OpenRouter's shape, and rebuild `BrandMark` over `@lobehub/icons`.
5. **The local surface** replaces the placeholder note: the detect step, the runtime row with its observed standing, and the inert chip tone.
6. **The records** move in step: two feature files, the runtime stub, the regenerated baselines, the cspell vocabulary, and ADRs 0072 through 0074.

### The aggregator half

The Aggregators catalog grows from one entry to seven. OpenRouter keeps its connect: the two-field key form, the `aggregator` kind, the vault write, all unchanged. Together AI, Fireworks AI, Groq, DeepInfra, Cerebras, and a Custom aggregator escape hatch stand inert under Soon badges. Five of the six host their own open-model catalogs rather than routing to other providers. The destination subtitle therefore stops claiming "many providers" and becomes "One key, many models, routed through a hosted catalog."

The connected row already renders in the two-line key anatomy, and `checkableKey` already withholds Verify from it. This change adds no check and records why. OpenRouter serves its model catalog to anyone, so a models probe answers about the service, never about the key. The endpoint that would answer, the credential-scoped key report, returns spend and limit data this surface has nowhere to put yet. The row stays quiet rather than half-checked, and ADR 0073 carries the rationale.

One rule underneath is worth stating once, because it decides every row's trailing edge. **A row carries a standing exactly when recompose can observe one without spending.** A subscription observes local evidence, so its row carries a chip. A local runtime observes a loopback answer, so its row carries a chip. A key and an aggregator would have to spend, or half-answer, so their rows stay quiet.

The key field also learns OpenRouter's documented shape. The empty field hints `sk-or-v1-…`, and the shipped recognizer learns the prefix. Coverage runs one way, named here so nobody assumes symmetry. An OpenRouter-shaped key pasted into a first-party field now warns. A first-party key pasted into the OpenRouter field warns only for the `sk-ant-` family, because that's the only first-party shape the vendors document. The warning still never refuses, exactly as the api-keys contract grants.

### The local half: detect, decide, store

```
detect step            main                       engine child           Ollama
 |                       |                            |                     |
 |-- detect {ollama} --->|                            |                     |
 |                       |-- address from the table   |                     |
 |                       |-- probe-runtime {addr} --->|                     |
 |                       |                            |-- GET /api/version >|
 |                       |                            |<-- {"version"} -----|
 |                       |<-- runtime-check {answers}-|                     |
 |<-- answers {version}--|                            |                     |
 |                       |                            |                     |
 |-- Add                 |                            |                     |
 |-- connect-local ----->|                            |                     |
 |                       |-- append the local row (no vault, no secret)     |
 |<-- the document ------|                            |                     |
```

Picking Ollama looks at once, and no button asks permission to look. The shipped sign-in step set the precedent: it reads the machine on entry and reports what it found. The detect step inherits that grammar for a loopback GET that carries no secret and stores nothing.

The step has three faces, and the verdict slot reserves its height while looking, so the sheet never jumps twice. Looking reads a quiet Checking line in the slot the verdict will fill. An answer reads "Ollama is running at 127.0.0.1:11434." with the version the runtime returned beneath, and the footer's primary is Add. A non-answer reads its own sentence: silence reads "Ollama isn't running at 127.0.0.1:11434. Start it, then check again." while a strange answer says another server answered there. On a non-answer the primary is Check again, and Add anyway stands beside it as a plain act. Deciding includes adding a server the person will start later, and the default on a failed look is never a write.

Adding stores the `local` arm: the runtime id and the address main mints from the contracts-owned table. The renderer never supplies an address, so no row can ever hold `localhost`, the host behind the recorded defect where Node resolves it to IPv6 while Ollama listens on IPv4.

### The local row and its observed standing

A stored row reuses the subscription row's anatomy: the runtime's mark and name over a second line, a chip at the trailing edge. The second line carries the stored address in the mono value style the masked key tail already wears. The version stays on the detect step, so the row keeps two lines.

The standing is an observation, never a stored fact. The account list suspends on the registry and the standing doesn't. Rows render at once with a Checking reading and settle one by one, outside the suspense boundary, so a slow look never blanks the page. The row re-reads on every mount and on every Check again, and a remount forgets the last answer. A server that stopped after the last look reads Not running at the next one, and the stored address never changes underneath it.

Each verdict owns one word, one tone, and one token, stated here so nobody decides it at the keyboard.

| Reading      | Word                    | Tone       | Mark                    |
| ------------ | ----------------------- | ---------- | ----------------------- |
| answers      | Running                 | positive   | dot on `bg-running`     |
| unreachable  | Not running             | inert, new | dot on the tertiary ink |
| unrecognized | Another server answered | attention  | dot on `bg-attention`   |
| in flight    | Checking                | inert ink  | no dot                  |

The chip gains the one inert tone. The dot draws from the existing `ink-tertiary` token, and the word takes the standard secondary text ink, because tertiary text measured under the contrast gate. Nothing borrows a neighbor's color. The in-flight reading isn't a standing yet, so it draws the inert ink as a plain line without the dot. The row's acts, Check again and Remove, live behind the overflow, matching the key row.

### The probes stay side by side in the child

The reachability probe takes the home ADR 0070 chose: a pure fetch-injected module under `packages/engine/src/provider/`, reached through a new `probe-runtime` directive on the parent-port protocol. It sends `GET /api/version`, refuses redirects, and carries its own bound of three seconds, because a loopback answer arrives fast or not at all.

The verdicts are the probe's own three, disjoint from the key-check triad and never stored. A response whose body parses as a version answers `answers`, carrying the version. Any other HTTP answer is `unrecognized`, carrying the status, so a stranger squatting the port never reads as Ollama. A thrown fetch, a refused redirect, and a timeout all read as `unreachable`. The child mints every verdict, and main folds a dead child and a host timeout to `unreachable`, because the person's remedy is the same.

One asymmetry against the key probe is deliberate: this probe reads the response body, because the version is the observation, and no credential exists on this path to leak. The loopback-only address schema on the directive means the child can never aim off the machine, even when main holds a bad address. The e2e seam mirrors the key probe's. The child honors `RECOMPOSE_RUNTIME_ORIGIN` only when it names a loopback host, so the stub owns the origin and a developer's real Ollama never answers a scenario.

### Marks for vendors, glyphs for categories

Every vendor entry, connectable and Soon alike, draws its real mark across all four destinations. The marks come from `@lobehub/icons`: tree-shakable React components under the `MIT` license, with mono and color variants. A connectable card draws the color variant. A Soon card draws the mono variant on tertiary ink at full opacity, and the card's `opacity-60` dimming deletes, so the Soon badge stops inheriting a faded subtree. Inertness reads through the badge, the `aria-disabled` anatomy, and the tonal inks instead.

The rule is a vendor draws its mark and a category draws the shared network glyph. The three Custom entries are categories, so the glyph is the rule there rather than an exception. llama.cpp publishes no mark and keeps a server glyph. The letter monogram retires, and the hand-vectored Anthropic and OpenAI paths retire with it. `BrandMarkName` stops standing in for the connectable-provider identity, because Soon cards now carry marks too: the catalog gets its own `CatalogProviderId`, and the mark names become the wider inventory. ADR 0074 carries the dependency and the trademark stance.

### Trade-offs in view

The design accepts one loopback fetch per local row per mount. The alternative was a stored standing, and acceptance C2 shows why that lies faster for locals than for keys. A local server stops between two renders far more often than a vendor revokes a key. Forgetting is the honest cache policy, and the fetch is loopback-cheap.

The design also accepts that the aggregator row offers less than the key row beside it. A half-check that blesses garbage keys would cost more than the absence, and the standing family rule makes the absence legible rather than accidental.

## Data model and contracts

### The accounts document, version 4

`packages/contracts/src/accounts.ts` moves to version 4. The union gains its third arm and nothing else changes shape.

```ts
export const ACCOUNTS_VERSION = 4;

const localAccountSchema = z.strictObject({
  id: nonBlankString,
  provider: localRuntimeIdSchema,
  kind: z.literal('local'),
  address: loopbackAddressSchema,
});

const accountSchema = z.discriminatedUnion('kind', [
  subscriptionAccountSchema,
  credentialedAccountSchema,
  localAccountSchema,
]);
```

The arm carries no `label`, because the runtime's name is the row's name, and no `credentialRef`, because nothing exists to reference. It parses as a `strictObject`, so a credential on a local row is a parse error rather than a review note, the mechanism ADR 0069 set. The migration from 3 to 4 restamps the version and touches no row, mirroring the 2-to-3 step. The bump is mandatory under ADR 0062: one version names one shape, and version 3 refuses the arm.

### The local-runtimes module

`packages/contracts/src/local-runtimes.ts` opens as the shared vocabulary of runtimes, addresses, and reachability, mirroring `api-keys.ts`.

```ts
export const localRuntimeIdSchema = z.enum(['ollama']);

export const localRuntimeAddresses = {
  ollama: 'http://127.0.0.1:11434',
} as const satisfies Record<LocalRuntimeId, string>;

export const loopbackAddressSchema = z
  .string()
  .refine(isItsOwnLoopbackOrigin, 'the address must be a loopback origin');

export const runtimeReachabilitySchema = z.discriminatedUnion('verdict', [
  z.strictObject({ verdict: z.literal('answers'), version: nonBlankString }),
  z.strictObject({ verdict: z.literal('unrecognized'), status: z.number().int() }),
  z.strictObject({ verdict: z.literal('unreachable') }),
]);
```

The address table is the one authority on where a runtime documents itself, and main mints stored addresses from it alone. The loopback schema admits exactly the strings that equal their own parsed origin and name the host `127.0.0.1`. That one rule refuses `localhost`, paths, credentials, query strings, trailing slashes, and every off-machine host at the parse. The verdict union is disjoint from the key-check triad on purpose: `answers` carries the version, `unrecognized` carries the status, and `unreachable` carries nothing. No verdict is ever stored.

### The key-shape recognizer widens one way

`packages/contracts/src/api-keys.ts` keeps its module and widens two members.

```ts
export const recognizedKeyShapeSchema = z.enum(['anthropic', 'openai', 'openrouter']);

export function vendorShapeOf(pasted: string): RecognizedKeyShape | undefined;
```

`vendorShapeOf` learns the `sk-or-v1-` opening beside the `sk-ant-` opening it knows, and its return widens past the first-party id set. OpenAI's inventory stays undocumented, so an OpenAI key in the OpenRouter field draws no warning, and that silence is coverage rather than a gap. The warning still never refuses: `pastedKeySchema` doesn't change, so a key shaped like another vendor's warns and connects.

### The engine protocol grows a runtime directive

`packages/contracts/src/engine-protocol.ts` gains the fourth directive arm and the third report arm.

```ts
z.strictObject({
  kind: z.literal('probe-runtime'),
  id: directiveIdSchema,
  address: loopbackAddressSchema,
});

z.strictObject({
  kind: z.literal('runtime-check'),
  answers: directiveIdSchema,
  reachability: runtimeReachabilitySchema,
});
```

The directive carries no secret, and the report answers by directive id like its siblings, per ADR 0066. The address field parses through the loopback schema, which pins the probe's aim at the parse.

### The channel registry

`ipcChannels` grows from twenty-one entries to twenty-four. `IpcChannel`, `IpcRequest`, `IpcResponse`, and `RecomposeIpc` all derive from the map, so the type surface follows.

| Channel                   | Request                                             | Response                               |
| ------------------------- | --------------------------------------------------- | -------------------------------------- |
| `accounts:connect-local`  | `z.strictObject({ runtime: localRuntimeIdSchema })` | `ipcResult(accountsDocumentSchema)`    |
| `accounts:detect-runtime` | `z.strictObject({ runtime: localRuntimeIdSchema })` | `ipcResult(runtimeReachabilitySchema)` |
| `accounts:check-runtime`  | `z.strictObject({ id: nonBlankString })`            | `ipcResult(runtimeReachabilitySchema)` |

No request on the local path has a secret field, so a local account with a secret is impossible by construction. Detect answers from the documented table address before anything stores. Check answers from the stored row's address. `ipcErrorSchema` stays at twelve codes: the already-connected refusal reuses `name-conflict`, and a non-answer is a verdict rather than an error.

### Storage contracts

The vault doesn't change, and the local path never reads or writes it. `accounts.json` stays the registry main owns, and every local write goes through `amendAccountsFile`, whose lane already serializes read-modify-write turns. The connect's already-held check and its append share one amend turn, so two racing adds can't both mint a row. Removing a local row releases nothing, because there's no secret to delete.

### The type-level specs

`ipc.test-d.ts` moves its totality assertion to twenty-four channels. `accounts.test-d.ts` pins that the local arm carries no `credentialRef`, no `label`, and no secret-shaped property, and that `Account` still discriminates on `kind`. A new pin asserts `IpcRequest<'accounts:connect-local'>` has no `secret` member. `engine-protocol.test-d.ts` pins that the report union discriminates on `kind` and the runtime arm carries only the id it answers and the reachability.

## Error handling

| Failure                                                   | Representation                                              | The screen shows                                                     |
| --------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| Nothing answers at the address                            | `verdict: 'unreachable'`, not an error                      | the silence face on detect, or Not running on the row                |
| An HTTP answer isn't a version body                       | `verdict: 'unrecognized'` with the status                   | the another-server sentence, or Another server answered on the row   |
| The engine child dies or the host wait runs out           | `verdict: 'unreachable'`, logged in main with context       | the same faces, because the person's remedy is the same              |
| The child refuses a directive with a non-loopback address | sanitized log, issue paths and codes, never received values | nothing, and the host wait folds to `unreachable`                    |
| Connecting a runtime that already stands                  | `ok: false`, `name-conflict`, message names the runtime     | the step's refusal sentence, and the stored row survives untouched   |
| Checking a row that's missing or not local                | `ok: false`, `storage-failed`, names the operation          | the standard refusal path                                            |
| A malformed request crosses the bridge                    | `ok: false`, `validation-failed`                            | the standard refusal path                                            |
| A version 4 document meets an older build                 | `AccountsNewerSchemaError`, `accounts-newer-schema`         | the stored file survives untouched, reported rather than quarantined |
| An aggregator key that no longer works                    | not representable here                                      | nothing, by decision 2: no check exists to ask                       |

Three rules bind the handlers. No silent failures: every fold to `unreachable` logs what failed in main, naming the runtime and the operation. Expected failures travel as typed values: a server that doesn't answer is a verdict, because it describes the machine rather than refusing the act. And no verdict outlives its screen: the reading lives in the query that asked, and a remount forgets it.

## File map

### Contracts

- `packages/contracts/src/accounts.ts`: version 4, the `local` arm, and the pass-through migration (modify)
- `packages/contracts/src/accounts.test.ts` and `accounts-migration.test.ts`: the arm's admission and refusals, and the migration behavior (modify)
- `packages/contracts/src/accounts.test-d.ts`: the no-credential and no-label pins on the local arm (modify)
- `packages/contracts/src/local-runtimes.ts`: runtime ids, the address table, the loopback schema, and the reachability verdicts (create)
- `packages/contracts/src/local-runtimes.test.ts`: schema behavior with fast-check properties over the loopback rule (create)
- `packages/contracts/src/api-keys.ts`: the recognized-shape enum and the `sk-or-v1-` opening (modify)
- `packages/contracts/src/api-keys.test.ts`: the one-way widening and the warn-never-refuse property (modify)
- `packages/contracts/src/engine-protocol.ts`: the `probe-runtime` directive and the `runtime-check` report (modify)
- `packages/contracts/src/engine-protocol.test.ts` and `engine-protocol.test-d.ts`: the unions' admission, refusal, and pins (modify)
- `packages/contracts/src/ipc.ts`: the three local channels (modify)
- `packages/contracts/src/ipc.test.ts` and `ipc.test-d.ts`: the roster and totality move to twenty-four (modify)
- `packages/contracts/src/index.ts`: re-exports the local-runtimes module (modify)

### Engine

- `packages/engine/src/provider/runtime-probe.ts`: the pure fetch-injected probe, the version parse, refused redirects, the three-second bound, and the verdict folding (create)
- `packages/engine/src/provider/runtime-probe.test.ts`: the folding table and properties over an injected fetch (create)
- `packages/engine/src/engine-child.ts`: the `probe-runtime` dispatch and the loopback-guarded `RECOMPOSE_RUNTIME_ORIGIN` override (modify)
- `packages/engine/src/engine-child.test.ts` and `engine-child-probe-origin.test.ts`: the round trip and the override rules (modify)

### Main process

- `apps/desktop/src/main/engine-host/engine-probe.ts`: the runtime desk beside the key desk, and the exit fold to `unreachable` (modify)
- `apps/desktop/src/main/engine-host/engine-host.ts`: the `probeRuntime` method and report routing for the new kind (modify)
- `apps/desktop/src/main/engine-host/engine-host-probe.test.ts`: runtime answers, child-death folding, and the bound relation (modify)
- `apps/desktop/src/main/ipc/local-runtimes-ipc.ts`: the three handlers, the minted address, the one-amend-turn refusal, and no vault import (create)
- `apps/desktop/src/main/ipc/local-runtimes-ipc.test.ts`: handler specs against temp storage and a scripted probe, including the vault-never-created assertion (create)
- `apps/desktop/src/main/ipc/storage-ipc.ts`: the remove branch that releases nothing for a local row (modify)
- `apps/desktop/src/main/ipc/storage-ipc.test.ts`: the local removal behavior (modify)
- `apps/desktop/src/main/ipc/dispatch.ts` and `dispatch.test.ts`: `ipcChannelNames` moves to twenty-four (modify)
- `apps/desktop/src/main/storage/accounts-store.test.ts`: its stored fixture moves to version 4 (modify)
- `apps/desktop/src/main/index.ts`: composes the local handlers over the engine host (modify)
- `apps/desktop/src/preload/index.ts`: three bridge entries (modify)

### Renderer, catalog and marks

- `apps/desktop/package.json`: the `@lobehub/icons` dependency (modify)
- `apps/desktop/src/renderer/src/pages/providers/model/provider-catalog.ts`: `ConnectionWay` widens to every kind, `CatalogProviderId` decouples from the mark type, the Ollama entry, both awaited lists, the OpenRouter shape hint, `localRuntimeOf`, and the local-skipping guard in `keyKindOf` and `keyTitleFor` (modify)
- `apps/desktop/src/renderer/src/pages/providers/model/provider-catalog.test.ts`: the new entries, lists, and guards (modify)
- `apps/desktop/src/renderer/src/pages/providers/ui/catalog-list/catalog-list.tsx`: the local special case deletes, awaited cards lead with a mark or a glyph, and the opacity dimming leaves (modify)
- `apps/desktop/src/renderer/src/pages/providers/ui/catalog-list/catalog-list.stories.tsx` and `catalog-list.browser.test.tsx`: follow (modify)
- `apps/desktop/src/renderer/src/shared/ui/brand-mark/brand-mark.tsx`: rebuilds over `@lobehub/icons` with color and mono variants, and the monogram retires (modify)
- `apps/desktop/src/renderer/src/shared/ui/brand-mark/brand-mark.stories.tsx` and `brand-mark.browser.test.tsx`: the widened inventory in both variants (modify)

### Renderer, local surface

- `apps/desktop/src/renderer/src/pages/providers/ui/providers-page/providers-page.tsx`: the local branch swaps to the real surface, and the aggregator subtitle takes the design's sentence (modify)
- `apps/desktop/src/renderer/src/pages/providers/ui/provider-connect-way/provider-connect-way.tsx`: the local way forks to the detect step (modify)
- `apps/desktop/src/renderer/src/pages/providers/ui/catalog-flow/catalog-flow.tsx`: `connectStepFor` stops excluding local, and the local sheet description rewrites (modify)
- `apps/desktop/src/renderer/src/pages/providers/ui/detect-runtime-step/detect-runtime-step.tsx`: the three faces, the reserved-height slot, and the Add, Check again, and Add anyway acts (create)
- `apps/desktop/src/renderer/src/pages/providers/ui/local-runtimes-surface/local-runtimes-surface.tsx`: the stored local rows off the accounts query, or the empty state (create)
- `apps/desktop/src/renderer/src/pages/providers/ui/local-runtime-row/local-runtime-row.tsx`: the two-line row, the mono address, the observed standing, and the overflow (create)
- `apps/desktop/src/renderer/src/pages/providers/ui/local-runtimes-empty-state/local-runtimes-empty-state.tsx`: what the destination holds before a runtime connects (create)
- Stories and browser-test siblings for all four new components (create)
- `apps/desktop/src/renderer/src/pages/providers/ui/local-runtimes-note/`: retires with its stories (delete)
- `apps/desktop/src/renderer/src/shared/ui/status-chip/status-chip.tsx`: the inert tone, a tertiary-ink dot beside a secondary-ink word (modify)
- `apps/desktop/src/renderer/src/shared/ui/status-chip/status-chip.stories.tsx` and `status-chip.browser.test.tsx`: follow (modify)
- `apps/desktop/src/renderer/src/shared/api/accounts.ts`: `useConnectLocalRuntime`, `runtimeDetectionQueryOptions`, and `runtimeStandingQueryOptions` (modify)
- `apps/desktop/src/renderer/src/shared/testing/fake-accounts.ts` and `fake-bridge.ts`: the local handlers and the seedable reachability answer (modify)

### End to end, records, and repository files

- `apps/desktop/e2e/runtime-stub.ts`: the loopback stub serving `/api/version` with scripted answers, silence, and strangers (create)
- `apps/desktop/e2e/fixtures.ts`: the `RECOMPOSE_RUNTIME_ORIGIN` override beside the probe and keychain overrides (modify)
- `apps/desktop/e2e/features/providers/aggregators.feature` and `local-runtimes.feature`: the approved scenarios from both spec deltas (create)
- `apps/desktop/e2e/features/providers/catalog.feature`: the Soon-count assertions shift (modify)
- `apps/desktop/e2e/provider-screen.ts` and `apps/desktop/e2e/steps/`: openers, detect faces, standings, and count bindings (modify)
- `apps/desktop/e2e/visual.spec.ts-snapshots/`: every baseline that shows a mark regenerates on all three platforms (modify)
- `cspell-words.txt`: the vocabulary this change's artifacts and diff introduce, lobehub included (modify)
- `docs/adr/0072-*.md`, `docs/adr/0073-*.md`, `docs/adr/0074-*.md`, and `docs/adr/README.md`: land at implementation from the drafts in decisions 1 through 3 (create)

The contracts Stryker gate mutates the local-runtimes module and the migration as ordinary logic. The engine gate mutates `runtime-probe.ts` and the child dispatch. The desktop gate mutates the local handlers, the host folding, and the remove branch. Nothing new joins the vitest or Stryker exclusion lists, which is rider #118's standing ask.

## Interfaces

### Contracts

- Consumes: `zod`, `nonBlankString`, `ipcResult`, and the migration stepper.
- Produces:
  - `ACCOUNTS_VERSION` at 4, the `LocalAccount` arm, and the widened `Account` union
  - `localRuntimeIdSchema`, `LocalRuntimeId`, `localRuntimeAddresses`, `loopbackAddressSchema`, `runtimeReachabilitySchema`, and `RuntimeReachability`
  - `recognizedKeyShapeSchema`, `RecognizedKeyShape`, and the widened `vendorShapeOf()`
  - the `probe-runtime` directive arm, the `runtime-check` report arm, and `IpcChannel` widened to twenty-four members

### Engine

- Consumes: the contracts surface and the platform `fetch` through injection.
- Produces:
  - `probeRuntime(fetchLike: typeof fetch, address: string): Promise<RuntimeReachability>`
  - the child's `probe-runtime` dispatch and the loopback-guarded runtime-origin override

### Main

- Consumes: the contracts surface, the engine host, and the accounts store.
- Produces:
  - `probeRuntime(address: string): Promise<RuntimeReachability>` on `EngineHost`, folding every non-answer to `unreachable`
  - `createLocalRuntimesIpcHandlers(ctx): Pick<IpcHandlers, 'accounts:connect-local' | 'accounts:detect-runtime' | 'accounts:check-runtime'>`
  - the remove that releases nothing for a local row

### Renderer

- Consumes: the twenty-four-channel bridge, `unwrapIpcResult`, `withRefusal`, and the kit.
- Produces:
  - `shared/api`: `useConnectLocalRuntime()`, `runtimeDetectionQueryOptions(runtime)`, and `runtimeStandingQueryOptions(id)`, both query options with `gcTime: 0` so a remount forgets
  - `shared/ui`: `BrandMark` with `variant: 'color' | 'mono'` over the widened name set, and `StatusChip` with the `inert` tone
  - `pages/providers`: `DetectRuntimeStep`, `LocalRuntimesSurface`, `LocalRuntimeRow`, `CatalogProviderId`, and `localRuntimeOf`, all through the slice's public interface

## Decisions

### 1. A local runtime account is a credential-free observation

This is the local half's architectural decision, and it lands as ADR 0072. The draft follows.

**Context.** The Local Runtimes destination routes to a placeholder, and the accounts document refuses to store a local row. ADR 0069 splits the account row by kind and gives only the credentialed kinds a `credentialRef`, enforced as a parse error. A local runtime inverts the credential story: Ollama serves loopback with no key and ignores any it receives, so there's nothing to store and nothing to check. The reading a person needs is reachability. The defect record binds the address: Node resolves `localhost` to IPv6 while Ollama listens on IPv4, producing connection refusals that a literal `127.0.0.1` never produces. ADR 0070 put provider probes in the engine child behind the `desktop-not-into-engine` wall.

**Decision.** A local account is its own union arm: `{ id, provider, kind: 'local', address }`, parsed as a `strictObject` with no `label` and no `credentialRef`. `ACCOUNTS_VERSION` moves from 3 to 4 with a restamp-only migration, so an older build refuses the newer document readably instead of quarantining it. Main mints the stored address from a contracts-owned table, `http://127.0.0.1:11434` for Ollama, and the renderer never supplies one. A loopback-only schema guards the address at every parse, in the document and on the probe directive alike. Reachability is a probe the engine child runs through a `probe-runtime` directive beside the key probe: `GET /api/version`, redirects refused, a three-second bound. The child mints three verdicts disjoint from the key-check triad: `answers` with the version, `unrecognized` with the status, and `unreachable`. Main folds a dead child to `unreachable`. Detection runs before adding and stores nothing until the person decides. A stored row re-observes its standing on every mount, and no verdict is ever stored. The connect channel takes only the runtime id, so a local account with a secret is impossible by construction.

**Alternatives.** A token-optional credentialed arm, rejected: it makes the required field optional and dissolves ADR 0069's parse-error gate into a review note. An editable base URL, rejected: the recorded defect classes are exactly `localhost` resolution and path normalization, and one documented address needs no field. Storing the standing beside the row, rejected: a local server stops between two renders far more often than a vendor revokes a key. The stored claim would lie faster than ADR 0070's case. A port sweep to find runtimes, rejected: it's a firewall-prompt generator and sits badly beside an offline-first posture.

**Consequences.** **Good**: the forbidden states have no shape, so no test, review, or migration has to police a credential on a local row. The registry stores only what a person decided, and a squatting stranger never reads as Ollama. **Bad**: a row costs one loopback fetch per mount, and a standing can lag the truth by one observation. The fixed address means a relocated `OLLAMA_HOST` can't connect, and the design says so rather than offering a field. A dead engine child reads as Not running rather than as an error a person can act on, with the honest detail in main's log.

**ADR draft:** `docs/adr/0072-a-local-runtime-account-is-a-credential-free-observation.md`, from the text above.

### 2. The aggregator connects as a key and offers no check

This is the aggregator half's architectural decision, and it lands as ADR 0073. The draft follows.

**Context.** OpenRouter already connects through the key machinery under the `aggregator` kind. ADR 0070 fixed key verification as `GET /v1/models` against the vendor's own host. OpenRouter serves that catalog without authentication: its docs fetch the models list with no header, so a 200 proves the service is up and says nothing about the key. A probe built that way would bless a garbage key, which is worse than no probe. The endpoint that does answer about the key, the credential-scoped key report, returns spend, limit, and tier data. This surface has nowhere to put any of it: the row holds a title, a name, and a mask.

**Decision.** OpenRouter connects exactly as a key: the two-field form, the vault write, the `aggregator` kind, the two-line row anatomy. The row offers no Verify act anywhere on or behind it, and `checkableKey` stays the single gate that decides. The check waits for the surface that can hold what the honest endpoint returns, rather than shipping half of one now. The family rule appears once, here: **a row carries a standing exactly when recompose can observe one without spending.** Subscription rows observe local evidence, so they carry a chip. Local rows observe a loopback answer, so they carry a chip. Key and aggregator rows would have to spend or half-answer, so they stay quiet, and the key row's Verify act stays an explicit question rather than a standing.

**Alternatives.** Adding `openrouter` to the key-probe enum, rejected: the models list is public, so the probe would answer `authenticates` for any string. A false green on a credential is the one lie this screen must never tell. Probing the credential-scoped key report now, rejected: its answer carries limit and usage data with no home on the row. Folding it to a bare verdict discards exactly what the person would act on. Widening ADR 0070's verdict triad for one vendor, rejected: the triad describes first-party key checks, and a fourth arm for one aggregator couples two families that age differently.

**Consequences.** **Good**: no aggregator row can claim what nobody verified, and the quiet row is a rule rather than an oversight. The standing family rule now decides every future row's trailing edge without a meeting. **Bad**: a dead OpenRouter key surfaces at spend time, not before. The person who wants reassurance today doesn't get it, and the later change that builds a spend surface inherits the check as scope.

**ADR draft:** `docs/adr/0073-the-aggregator-connects-as-a-key-and-offers-no-check.md`, from the text above.

### 3. Brand marks come from `@lobehub/icons`, drawn as nominative use

This is the marks decision, and it lands as ADR 0074. The draft follows.

**Context.** The mark set holds hand-vectored Anthropic and OpenAI paths and a boxed-letter monogram for OpenRouter, and every awaited row carries a generic glyph. This change grows the catalog to more than twenty named vendors across four destinations, and a wall of monograms and glyphs stops reading. The mark-name type is also welded to the connectable-provider identity, which breaks the moment a Soon card carries a mark.

**Decision.** The marks come from `@lobehub/icons`: tree-shakable React components under the `MIT` license, with mono and color variants, purpose-built to cover AI vendors. The rule is a vendor draws its real mark and a category draws the shared network glyph. The inventory covers Anthropic, OpenAI, OpenRouter, Ollama, Together AI, Fireworks AI, Groq, DeepInfra, Cerebras, LM Studio, and vLLM. It also covers Gemini, Mistral, xAI Grok, DeepSeek, Moonshot AI, Qwen, GitHub Copilot, Kimi, `GLM`, and MiniMax. llama.cpp publishes no mark, so it keeps a server glyph, the one named miss in the inventory. The three Custom entries are categories and keep the network glyph as the rule. A connectable card draws the color variant. A Soon card draws the mono variant on tertiary ink at full opacity, and no subtree dims by opacity, so the Soon badge reads at full strength. The monogram retires, and `BrandMarkName` decouples from the connectable-provider identity type. The trademark stance rides with the dependency: the `MIT` license covers the code, not the marks. Each logo remains its vendor's trademark, and recompose draws it solely to identify that vendor's own service a person connects to, which is nominative use. No mark implies endorsement, and a vendor's objection swaps its mark back to a glyph.

**Alternatives.** Keeping monograms and glyphs, rejected: twenty look-alike squares defeat the recognition a catalog exists for. Hand-vectoring each mark, rejected: it carries the same trademark posture with none of the coverage, and every vendor rebrand becomes local maintenance. `simple-icons`, rejected: it lacks the AI-vendor coverage and the paired mono and color variants this catalog needs. Fetching logos from a metadata catalog, rejected: the research brief already marks that dependency wrong for an offline-first app.

**Consequences.** **Good**: every destination reads by shape before words, one dependency replaces hand-kept vectors, and the vendor-or-category rule decides future entries on its own. **Bad**: every visual baseline that shows a mark changes in one release, and regeneration runs through the `update-baselines` label on CI, never locally. The icon set now updates on the package's cadence through Renovate. The design carries the trademark risk in the open rather than avoiding it, and the llama.cpp asymmetry stands until that project publishes a mark.

**ADR draft:** `docs/adr/0074-brand-marks-come-from-lobehub-icons.md`, from the text above.

### 4. Detection fires on entry, and the default on a failed look is never a write

Picking Ollama looks at once. The sign-in step set the precedent: it reads the machine on entry and reports what it found, without a button asking permission to look. The detect step inherits that grammar because the look is a loopback GET that carries no secret, stores nothing, and costs nothing a person would want to gate. The decision stays with the person: Add on an answer, Check again as the primary on a non-answer, and Add anyway as a plain act beside it. Adding a server the person will start later is a legitimate decision, so silence never disables the add. It only stops being the default.

**Alternatives considered:** a Detect button before the look, rejected because it adds a click that guards nothing and breaks the shipped step grammar. Storing on a successful detection without an act, rejected because detection is an observation and adding is a decision, and merging them writes without consent.

**ADR draft:** None. The step applies the shipped sign-in precedent and the proposal's own sentences.

### 5. The reachability verdicts speak their own vocabulary and never touch the key-check triad

`answers`, `unrecognized`, and `unreachable` form their own union in the local-runtimes module. The key-check triad describes what a vendor said about a credential. A reachability reading describes whether a machine answered, and `unrecognized` exists precisely because a port can answer without being Ollama. Sharing a union would force one family's words onto the other's facts. The verdicts map to fixed words, tones, and tokens in the design section above. The chip gains one inert tone drawn from the tertiary-ink token rather than borrowing a neighbor's color.

**Alternatives considered:** widening `keyCheckVerdictSchema`, rejected because every consumer of the triad would gain arms it can never receive. A bare boolean of reachable, rejected because it folds the squatter case into a lie in one direction or the other.

**ADR draft:** carried inside draft 1, which owns the local contract.

### 6. Local writes ride the existing amend lane, and the already-held refusal shares the turn

`accounts:connect-local` appends through `amendAccountsFile`, whose lane already serializes every read-modify-write of the registry. The handler decides inside the amend turn whether a row for the runtime already stands, and answers `name-conflict` naming the runtime when it does. Two racing adds therefore can't both mint. A second Ollama row would differ by nothing: the arm has no label and one documented address, so a duplicate is noise the refusal names. The vault queue stays out of the path entirely, because no local write touches a secret.

**Alternatives considered:** idempotent success on a duplicate add, rejected because a silent no-op hides the answer to what the person asked. Running the local connect inside the vault order like its siblings, rejected because it would couple the credential-free path to the vault's queue for no custody gain.

**ADR draft:** None. The refusal reuses a shipped code, and the lane already exists.

### 7. The recognizer widens one way, and the hint table stays a hint

`vendorShapeOf` learns `sk-or-v1-` and returns the widened `RecognizedKeyShape`. It still knows only documented families: `sk-ant-` and `sk-or-v1-`, with OpenAI's inventory undocumented and therefore silent. The empty-field hints are a separate table and keep all three shapes, because a hint is the vendor's published example rather than a recognition claim. Nothing refuses on shape, which the api-keys contract already grants and openclaw#72121 already justified.

**Alternatives considered:** a symmetric recognizer that guesses undocumented families, rejected because every guess past the documented set warns wrongly somewhere. Refusing a foreign-shaped key in the OpenRouter field, rejected as the shipped defect class the contract exists to prevent.

**ADR draft:** None. The api-keys contract already owns the rule, and this extends its data.

## Test matrix

| Layer          | What this layer proves (or why none)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Check command                                                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit           | In contracts: `local-runtimes.test.ts` proves the address table, the loopback refusals, and the verdict union. `accounts.test.ts` and `accounts-migration.test.ts` prove the local arm's admission, the credential refusal, and the 3-to-4 restamp. `api-keys.test.ts` proves the one-way recognizer. `engine-protocol.test.ts` and `ipc.test.ts` prove the new arms and the twenty-four-channel roster. In the engine: `runtime-probe.test.ts` proves the folding table over an injected fetch. In the renderer: `provider-catalog.test.ts` proves the Ollama entry, both awaited lists, and the local-skipping guards, and the browser tests prove the detect faces, the row's standing words, the inert chip, and both mark variants. | `pnpm run test`                                                                                                                                                       |
| Integration    | `local-runtimes-ipc.test.ts` proves the three handlers against real temp storage and a scripted probe: detect reads the table address, check reads the stored row's address, connect mints the canonical address, a second connect refuses, and no vault file is ever created or read. `engine-host-probe.test.ts` proves runtime answers, the dead-child fold to `unreachable`, and the host-above-child bound relation. `engine-child.test.ts` proves the directive round trip and the loopback-only origin override. `dispatch.test.ts` proves totality at twenty-four, and `storage-ipc.test.ts` proves a local removal releases nothing.                                                                                            | `pnpm run test`                                                                                                                                                       |
| End-to-end     | In the real shell with the runtime origin pointed at the loopback stub: `aggregators.feature` proves OpenRouter connects with a name and a key, lists under Aggregators, and offers no Verify act. `local-runtimes.feature` proves the detect faces on answer and on silence, the credential-free add, the add-anyway path, and the stored row reading Not running after its server stops. `catalog.feature` proves the shifted Soon counts. The visual suite re-proves every screen that draws a mark.                                                                                                                                                                                                                                  | `pnpm run test:e2e` and `pnpm --filter @recompose/desktop run test:e2e:visual`                                                                                        |
| Property       | In `accounts-migration.test.ts`: any version 3 document migrates to a valid version 4 document with every row byte-identical. In `local-runtimes.test.ts`: for arbitrary URL strings, the loopback schema admits exactly the strings that equal their own origin and name `127.0.0.1`. In `runtime-probe.test.ts`: for any status and body, the probe answers exactly one verdict, and answers `answers` only on an ok status with a parsable version. In `api-keys.test.ts`: any string whose trim opens `sk-or-v1-` recognizes as openrouter and still passes `pastedKeySchema`.                                                                                                                                                       | `pnpm run test`                                                                                                                                                       |
| Mutation scope | Three diff-scoped gates. The contracts gate mutates the local-runtimes module, the accounts arm, and the migration. The engine gate mutates `runtime-probe.ts` and the child dispatch. The desktop gate mutates the local handlers, the host folding, and the remove branch. The gate doesn't reach the renderer, so the detect step, the row, and the marks rest on the browser and property layers instead. Nothing new joins either exclusion list.                                                                                                                                                                                                                                                                                   | `pnpm --filter @recompose/contracts run test:mutation`, `pnpm --filter @recompose/engine run test:mutation`, and `pnpm --filter @recompose/desktop run test:mutation` |

### Designated mutant killers

| Invariant                                              | Mutant killer                                                          |
| ------------------------------------------------------ | ---------------------------------------------------------------------- |
| The migration touches no row                           | the byte-identical round-trip property in `accounts-migration.test.ts` |
| The loopback schema admits only its own origins        | the origin-equality property in `local-runtimes.test.ts`               |
| The folding answers one verdict and never overclaims   | the one-verdict-per-outcome property in `runtime-probe.test.ts`        |
| A squatter never reads as Ollama                       | the strange-body example answering `unrecognized` with its status      |
| The already-held refusal and the append share one turn | the racing-adds spec in `local-runtimes-ipc.test.ts`                   |
| The local path never touches the vault                 | the vault-never-created assertion in `local-runtimes-ipc.test.ts`      |
| A dead child folds to `unreachable`                    | the child-death example in `engine-host-probe.test.ts`                 |

The adversarial fix round retired the one equivalent mutant this table once recorded. The stalled-body specs now distinguish silence from a malformed body, so emptying the body-parse guard dies like any other mutant.

## Task decomposition hooks

Tasks run in parallel by default. A dispatch serializes only for a named blocker: one task reads what another produces, two tasks own the same file, or one inspects what another writes. Every dispatch names its files and states that the others run on disjoint files.

- Task 1: contracts (depends on: none, and it lands first and alone, because the version 4 bump must exist before anything can mint a local row; hands off: the local arm, the local-runtimes module, the widened recognizer, the protocol arms, and the twenty-four-channel surface). Owns `packages/contracts/src/`.
- Task 2: the engine probe (depends on: task 1, reads its schemas; hands off: the runtime probe, the child dispatch, and the origin override). Owns `packages/engine/src/`. Runs beside tasks 3 and 4 on disjoint files.
- Task 3: main (depends on: task 1, with a scripted probe standing in for task 2's real one; hands off: the three handlers, the host runtime probe, and the local remove branch). Owns `apps/desktop/src/main/` and `apps/desktop/src/preload/`. Runs beside tasks 2 and 4 on disjoint files.
- Task 4: the catalog and the marks (depends on: task 1 for types; hands off: `CatalogProviderId`, `localRuntimeOf`, the Ollama entry, both awaited lists, the shape hint, and the rebuilt `BrandMark`). Owns `apps/desktop/package.json`, `pages/providers/model/`, `pages/providers/ui/catalog-list/`, and `shared/ui/brand-mark/`. Runs beside tasks 2 and 3 on disjoint files.
- Task 5: the local surface (depends on: task 1 for types and task 4, because it reads `localRuntimeOf` and the widened `ConnectionWay` that task produces; hands off: the detect step, the surface, the row, and the seeded fake bridge). Owns `pages/providers/ui/` except `catalog-list/`, `shared/ui/status-chip/`, `shared/api/accounts.ts`, and `shared/testing/`. Runs beside tasks 2 and 3 on disjoint files.
- Task 6: acceptance and records (depends on: tasks 2 through 5, because it inspects the running app they produce; hands off: the merged branch evidence). Owns `apps/desktop/e2e/`, the visual baselines, `cspell-words.txt`, and ADRs 0072 through 0074 with their index rows.

## Risks

- [Risk] A local row writes before the version 4 schema exists → `amendAccountsFile` writes the amended document as typed, and the next load fails parse and quarantines the whole registry, so every stored account vanishes from the screen. Mitigation: the contracts cluster lands first and alone, and `accounts:connect-local` exists only in a tree that already carries the bump. The migration property pins the safe path.
- [Risk] A port squatter answers at 11434 → a stranger's HTTP answer must never read as Ollama. Mitigation: only a parsable version body answers `answers`, and `unrecognized` carries the status under its own attention word. Unmitigated: the squatter still occupies the address, and Add anyway can store a row whose server is a stranger, which the next look reports.
- [Risk] A developer's real Ollama answers the e2e suite → the silent scenarios would flake on any machine running the runtime. Mitigation: the stub seam owns the origin. The child honors `RECOMPOSE_RUNTIME_ORIGIN` only for loopback hosts, the fixtures always set it, and the app under test never aims at the documented port.
- [Risk] Visual baselines change everywhere a mark draws → one release redraws every destination's screenshots on three platforms. Mitigation: the `update-baselines` label owns regeneration on CI, never a local run, per the shipped baseline policy.
- [Risk] The inert tone reads as unavailable or vanishes in one scheme → tertiary ink at chip size is a close call. Mitigation: the `claude-in-chrome` pass measures the chip in both schemes from the page before it lands.
- [Risk] A dead engine child and a stopped server read the same → both fold to `unreachable`, and the honest difference lives in main's log line naming the fold. Unmitigated: the row can't tell a person their engine died, only that nothing answered.
- [Risk] `keyKindOf` and `keyTitleFor` meet the local offer and throw → both currently parse any non-subscription way as credentialed. Mitigation: task 4 adds the local-skipping guards with unit specs pinning that the Ollama entry answers neither helper.
- [Risk] The standing queries refetch in a loop or cache across mounts → either lies in one direction. Mitigation: both query options pin `gcTime: 0` with refetch on mount, and the row's browser test proves a remount re-asks.

## Migration and rollout

**Deploy.** One release carries the whole change, nothing behind a flag. No release of recompose has shipped, so the population of stored documents is developer machines.

**The accounts document moves to version 4.** The migration restamps the version and touches no row, and a fast-check property proves every row survives byte-identical. The bump is mandatory rather than ceremonial: the discriminated union refuses a `local` row at version 3, and ADR 0062 names one shape per version.

**Rollback.** A checkout from before this change refuses a version 4 document as newer than supported, which `AccountsNewerSchemaError` already does. The storage layer reports the refusal, and the file survives untouched rather than quarantined.

**What retires.** The `LocalRuntimesNote` placeholder and its stories leave. The `catalog-list` local special case leaves. The letter monogram and the hand-vectored mark paths leave. The catalog's Soon counts shift, so `catalog.feature` rewrites its assertions, and every baseline showing a mark regenerates through the label.

**Records that move in step.** ADRs 0072, 0073, and 0074 land from the drafts in decisions 1 through 3, with their index rows. The new vocabulary joins `cspell-words.txt` in the same diff that uses it. The sidebar needs no change: its Local Runtimes count starts moving the moment the contract stores a local row.

## Open questions

None.

## End-to-end verification

Run the desktop app from `apps/desktop` with `pnpm dev`, then walk the loop.

1. The sidebar's Aggregators destination opens its screen, subtitled "One key, many models, routed through a hosted catalog." Add provider opens a catalog of seven: OpenRouter answers the pointer, and six stand inert under Soon badges with the benefit lines the proposal states.
2. Picking OpenRouter opens the two-field form. The empty key field hints `sk-or-v1-…`, an `sk-ant-` paste draws the warning and still connects, and the stored row lists under Aggregators.
3. The OpenRouter row reads the product over the name and the mask, and no Verify act stands on the row or behind its overflow.
4. The Local Runtimes destination opens without the placeholder note. Add provider opens a catalog of five: Ollama answers the pointer, and LM Studio, llama.cpp, vLLM, and Custom local server stand inert under Soon.
5. With Ollama running, picking it reads Checking, then "Ollama is running at 127.0.0.1:11434." with the version beneath, and the slot never jumps. Add stores the row, and the sidebar count moves.
6. With Ollama stopped, the same pick reads the silence sentence, Check again stands primary, and Add anyway stores the row all the same.
7. The stored row reads Ollama over its mono address. Running shows the positive chip, stopping the server and remounting shows Not running on the inert tone, and a stranger on the port shows Another server answered.
8. Remove deletes the row without touching the vault file. A seeded version 3 document lists its old rows unchanged at version 4.
9. Every vendor card in all four destinations draws its real mark: color where connectable, mono on tertiary ink under Soon, with no dimmed subtree. The three Custom entries and llama.cpp keep their glyphs.
10. Both schemes get the `claude-in-chrome` pass: the inert chip's contrast, the mono marks on tertiary ink, the detect faces, and the Soon anatomy measured from the page.

A fresh-context reviewer diffs the result against these criteria:

- `accountsDocumentSchema` sits at version 4 with the credential-free `local` arm, the pass-through migration, and the `accounts.test-d.ts` pins.
- `ipcChannels` holds twenty-four entries, `ipcChannelNames` matches, the preload bridge matches, and no local request schema carries a secret field.
- The local path performs no vault read and no vault write, and `local-runtimes-ipc.ts` imports nothing from `vault.ts`.
- Every stored local address equals `http://127.0.0.1:11434`, and no code path can store `localhost`.
- The reachability verdicts stay disjoint from the key-check triad, and nothing stores either.
- `pnpm run lint:deps` stays green: main still never imports `packages/engine`.
- The placeholder leaves the tree, every new `ui/` component ships its stories, and `pnpm run lint:stories` and `pnpm run lint:fsd` pass.
- The approved features pass against the runtime stub, the baselines regenerate through the label on three platforms, and no aggregator row offers a check.
- ADRs 0072, 0073, and 0074 land from the drafts in decisions 1 through 3, and the index carries their rows.
