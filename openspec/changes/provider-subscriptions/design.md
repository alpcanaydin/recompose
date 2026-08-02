# Provider-subscriptions design

## Header and change linkage

- Change id: provider-subscriptions
- Schema: recompose
- Proposal: [proposal.md](proposal.md)
- Specs: [specs/subscriptions/spec.md](specs/subscriptions/spec.md)
- Discovery: [discovery/code-map.md](discovery/code-map.md), [discovery/technical-research.md](discovery/technical-research.md), [discovery/acceptance-references.md](discovery/acceptance-references.md), [discovery/mobbin-references.md](discovery/mobbin-references.md), [discovery/rider-ledger.md](discovery/rider-ledger.md)
- Tasks: [tasks.md](tasks.md)

## Context

recompose lists accounts as one flat form over three kinds, and it holds every credential as one vault string. The vendor closed the door the reference drew: no third party may offer a claude.ai login or route requests through plan credentials. The proposal answered by reframing a subscription as a managed account that the provider's own tool signs in, renews, and spends.

That reframing leaves four structural gaps this document closes. The repository holds no drawer container, though the proposal locked one for the catalog. The accounts document requires a `credentialRef` on every row, though a subscription row must never hold one. No process knows whether `claude` or `codex` exists on the machine, and the machine's answer differs under a windowed launch. And switching which account the official tool runs as needs explicit credential custody, because Claude Code on macOS keeps one keychain credential per operating-system user.

The design turns the locked decisions into contracts, files, tests, and task boundaries. It builds the drawer, versions the accounts document, puts the tool checks in main, and switches accounts through a pointer recompose owns.

## Discovery inputs consumed

- Code map, `packages/contracts/src/accounts.ts` entry: the three-kind enum and the required `credentialRef` become the version 2 union below.
- Code map, `packages/contracts/src/ipc.ts` entry: no channel detects the tool, lists subscription rows, or switches the active one, so five channels land.
- Code map, `apps/desktop/src/main/storage/vault.ts` entry: the string-valued vault stays untouched, because a subscription row references no vault entry at all.
- Code map, `apps/desktop/src/main/ipc/storage-ipc.ts` entry: `connectAccount` demands a secret, so its request narrows to the credentialed kinds and subscription connects travel their own channel.
- Code map, `sheet.tsx` and `create-gateway-sheet.tsx` entries: the borrow-or-build question for the container, answered below with build.
- Code map, `segmented-control.tsx` entry: the chip lands as its own component, because a segment picks one of a closed set and a chip narrows a list.
- Code map, `status-indicator.tsx` and `gateway-state.ts` entries: the dot-only indicator stays for gateways, and the word-beside-dot need becomes `StatusChip`.
- Code map, `icon.tsx` entry: the glyph set holds no brand mark, so the marks arrive as the named `BrandMark` set.
- Code map, `theme.css` entry: no amber attention pair exists, so the token work lands under the two-tier rule.
- Code map, providers page and route entries: the flat list, the form, and the kind field give way to the kind-scoped screen and the drawer.
- Code map, `fake-bridge.ts` and `recompose-bridge.tsx` entries: the five channels join the fake bridge, or no story and no browser spec can render the screen.
- Code map, e2e entries: `accounts.feature` rewrites around the drawer, and the two providers visual baselines regenerate on all three platforms.
- Code map, `README.md` entry: line 31 rewrites, because the promise it carries turned false.
- Code map, `.gitleaks.toml` and `lefthook.yml` entries: consulted and overruled for the guard, which lands structurally in contracts rather than as a new hook lane.
- Architecture Decision Record (ADR) 0016: main is the single writer and the only process that spawns children, so presence checks, sign-in launches, and standing reads all live in main.
- ADR-0065: the drawer's open state is view state, so it stays in the renderer as local component state.
- Research section 1.1, the prohibition: shapes the delegation, the fork copy, and the rewritten README line.
- Research section 2, gateway pass-through: consulted, no impact. The engine doesn't change in this round, and pass-through is its own later change.
- Research section 3, the native-app authorization standards: consulted, no impact, because no authorization flow lands here.
- Research section 5, the credential-set extension: consulted and overruled. No vault token bundle lands. The parked macOS blobs rest in the operating-system keychain, opaque and dormant, outside the vault.
- Acceptance section A: the terms line, the revocation line, and the quota line land in the fork and row copy.
- Acceptance sections B, C, and E: they govern an authorization flow and a gateway pass-through this change doesn't build, so they bind nothing here. Their defect records still shape the custody rules: park the freshest blob, park before place, and never refresh anything.
- Acceptance section D: D3 becomes the two new error codes, D4 keeps every check in main, and D6 becomes home deletion on remove. D1, D2, and D5 dissolve, because no stored bundle exists.
- Acceptance section F: F4 and F5 shape the two-state standing and the on-row restore.
- Mobbin, folk and Coda rows: the row anatomy and the on-row reconnect confirm the proposal's layout contract.
- Mobbin, Lindy row: the dot-beside-word standing.
- Mobbin, LangChain third state: consulted, no impact. Two states suffice, and the reasoning rides in decision 7.
- Rider ledger: empty. Issue #39's dangling-reference concern shrinks here, because subscription rows carry no `credentialRef` to dangle.
- First-party verification, retrieved 2026-08-01: the Claude Code authentication page stores macOS credentials in the keychain and scopes the `.credentials.json` relocation under `CLAUDE_CONFIG_DIR` to Linux and Windows. The machine confirms one keychain item, service `Claude Code-credentials`, account attribute the operating-system user, shared across config homes. The Codex references document `cli_auth_credentials_store`, where `file` keeps `auth.json` under `CODEX_HOME`. These three facts force the custody design in ADR-0069's draft.

## Goals and non-goals

**Goals:**

- A person connects a subscription by signing in through the provider's own tool, and the account appears once that tool reports success.
- The Subscriptions screen replaces the flat account list with a heading, a subtitle, an explaining empty state, and one row per account.
- A row carries the mark, the name with its plan, the account it signs in as, what it serves, its standing, and an overflow.
- A lapsed account reports the lapse on its own row and offers the way back there.
- The catalog opens in a right drawer with a search field, category chips, and grouped rows.
- A provider offering both ways presents them together, each naming what it yields.
- A person chooses which account the official tool runs as, with credential custody following each platform's documented limits.
- The accounts contract structurally refuses a subscription credential, and the sidebar gains its fourth destination.

**Non-goals:**

- No authorization flow of any kind: no browser handoff, no loopback listener, no code exchange, and no refresh.
- No stored subscription credential, no token bundle, and no vault entry for a subscription row.
- No gateway pass-through work. The engine and its refusals stay untouched.
- No OpenRouter or Hugging Face sign-in, though both vendors permit one. Keys serve them today.
- No Codex dialect work. Serving `/v1/responses` is its own change.
- No virtual model target picker. The never-a-target rule lands in the contract that any future picker must read.
- No local runtimes surface. The sidebar destination lands with a sentence naming what follows.
- No reads or writes of the vendor file stores under `~/.claude` or `~/.codex`. The one foreign object recompose touches is the Claude Code keychain item on macOS, inside custody alone.

## Constraints and invariants

- TypeScript runs at maximum strictness: `strict: true` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, and `noPropertyAccessFromIndexSignature`.
- No `any`, no `as` casts to silence errors, and no `@ts-ignore` or `@ts-expect-error` without a comment explaining why.
- Never write code comments. Code explains itself through naming and structure. The sole exception is a constraint the code can't express.
- Feature-Sliced Design (FSD) v2.1 governs every renderer file. Every slice exports through its `index.ts` public interface, and no slice reaches into another slice's internals.
- Main stays the single writer of `accounts.json` and the vault, and the only process that spawns children, per ADR-0016.
- Secrets flow, never rest, outside the vault, with ADR-0069's one recorded carve-out: parked macOS blobs rest in the operating-system keychain. No token material crosses the bridge, and the hygiene spec pins it.
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

1. **Contracts** version the accounts document to 2, split the row into a credentialed arm and a subscription arm, add the `local` kind, open the subscriptions module, and register five channels and two error codes.
2. **Main** grows a `subscriptions/` module set: the login-shell path probe, the tool presence check, the account homes with their active pointer, the standing observer, the sign-in launch, the macOS credential custody, and the handlers.
3. **The kit** gains the drawer, the chip, the badge, the status chip, the overflow menu, the brand marks, and the attention token pair.
4. **The providers page** becomes the kind-scoped screen: the subscriptions surface, the catalog drawer, the fork, and the key form, with the flat form and the kind field retiring.
5. **The records** move in step: the rewritten README line, the regenerated baselines, and ADR-0069.

### One home per account

Every subscription account owns one directory under recompose's user data: `subscriptions/<provider>/<account-id>/`. That directory is the account's config home. The provider's tool owns everything inside it, because sign-in runs the tool with its config-home variable pointed there. Claude Code reads `CLAUDE_CONFIG_DIR`, and Codex reads `CODEX_HOME`.

The variable isolates the tool's state per account on every platform. It isolates the credential only where the vendor documents that. Claude Code keeps `.credentials.json` under the config home on Linux and Windows alone, and its macOS credential lives in one keychain item per operating-system user. Codex keeps `auth.json` under `CODEX_HOME` when its credential store runs in file mode. recompose therefore seeds `cli_auth_credentials_store = "file"` into every Codex account home before the first sign-in.

The safety argument follows the platform. Wherever the credential rests inside the home, it keeps exactly one holder, the tool, and recompose never parses, copies, or refreshes it. On macOS, Claude Code's one keychain item is a shared slot, so recompose takes explicit custody of it. Custody parks the resident blob whole, places the chosen one, and never edits either. The person's own `~/.claude` and `~/.codex` file stores stay untouched either way.

### Signing in

```
drawer                 main                        terminal            pending home
  |                      |                             |                    |
  |-- sign-in {prov} --->|                             |                    |
  |                      |-- tool present? ------------|                    |
  |                      |   absent: tool-missing      |                    |
  |                      |-- reset pending home ------------------------->  |
  |                      |-- open terminal, env set -->|                    |
  |    (waiting state,   |                             |-- person signs in  |
  |     command shown)   |                             |-- tool writes ---> |
  |                      |-- poll standing observer ----------------------> |
  |                      |-- connected: mint id, promote home, append row   |
  |<-- ok: views --------|                             |                    |
```

`subscriptions:sign-in` resolves when the tool has finished, so the drawer's pending state is the waiting state. Main checks presence first and refuses with `tool-missing` before anything begins, which is the absent-tool scenario. On macOS, for Claude Code, it next parks the resident keychain credential, so the sign-in destroys no standing login. It then stages the provider's single pending home, opens the platform terminal running the tool with the environment set, and polls the standing observer. Completion evidence follows the platform: the credential record appearing in the home, or on macOS the vendor keychain item standing again. The sign-in empties that item before it launches the tool, so the item standing is proof of a fresh write rather than a timestamp to compare. The terminal launch is best effort: the waiting state always shows the exact command with a copy affordance, so a machine where no terminal opens still signs in by hand. On success main mints the account id, renames the pending home to it, appends the row, and answers the refreshed views. A first account for its provider also gets the active pointer. Nothing observed inside the wait bound answers `sign-in-timed-out`, and the pending home resets on the next attempt.

`subscriptions:restore` runs the same launch and watch against an existing account's home, which is the on-row way back for a lapsed account. On macOS it first makes that account the active one, so the fresh sign-in lands in the right custody slot.

### Credential custody on macOS

Claude Code on macOS keeps its credential in one keychain item, a generic password whose service is `Claude Code-credentials` and whose account attribute is the operating-system user. The item ignores config homes, so two sign-ins share it and the second overwrites the first. recompose therefore takes custody of that one item through the platform's `security` tool, spawned by main. Custody acts only inside connect, restore, switch, and remove, always behind the single-flight queue.

Custody keeps one parked keychain item per subscription account, named for the account id, plus one reserved parked item for the login that stood before the first connect. A parked blob is opaque bytes: recompose writes it whole, never edits it, never logs it, and never lets it cross the bridge.

What custody reads and writes, and when:

- **Connect** reads the vendor item and parks it under the active account, or under the reserved item when no account exists yet. The sign-in then writes the vendor item, and the new account becomes the active one.
- **Switch** re-reads the vendor item and parks it under the outgoing account, so the parked blob is the freshest one. It then places the incoming account's parked blob into the vendor item, and moves the pointer last.
- **Restore** on a lapsed account first switches to it, then launches the tool, whose sign-in rewrites the vendor item.
- **Remove** deletes the account's parked item. Removing the active account also clears the vendor item, and removing the last account writes the reserved login back.

The ordering is the crash argument: park before place, pointer last. A retry after a crash re-reads the vendor item, which stays the single truth for the active credential, so the window loses no blob. recompose still never refreshes anything. A parked blob's refresh token sits unused while parked, so rotation staleness can't arise from parking. What parking can't prevent is the login's hard lifetime expiring while parked, which then reads as a lapsed row with its way back.

One consequence reaches beyond recompose. Plain `claude` in any shell reads the same keychain item, so on macOS the machine-wide Claude Code login follows the active account. The shell line below keeps the tool's state on the same account as its credential, and the switch copy says both things before the first swap.

### Standing, observed not stored

The accounts document stores identity: id, provider, kind, and label. Everything else on a row is observation. At list time, main reads each account's home through a defensive, provider-shaped parser. The parser answers a view: the signed-in address, the plan where the record carries one, and a standing of `connected` or `lapsed`.

Connected means the account's credential evidence stands: the credential record in its home on the platforms that keep one there, or its keychain item on macOS. Lapsed means positive evidence against it: the evidence is absent, or the tool's status command reports signed out where one exists (`codex login status`). A keychain check reads item attributes alone, never the secret. The parser never throws on junk, treats absent as absent, and extracts nothing but the address and the plan. Token material never leaves main, and the hygiene spec grows an assertion saying so.

Two states suffice because both remedies are the same sentence: sign in again through the tool. A third "unconfirmed" state would split one remedy across two words.

### Switching

`subscriptions:activate` moves one link per provider: `subscriptions/<provider>/active`, a symlink on macOS and Linux and a junction on Windows, aimed at the chosen account's home. The pointer is the single truth of which account stands active, and views read it rather than storing a second copy. On macOS, for Claude Code, the same act first runs the custody swap above, and the pointer moves last.

The person's own shell follows through one line the surface hands out with a copy affordance:

```
export CLAUDE_CONFIG_DIR="$(readlink -f "<userData>/subscriptions/anthropic/active")"
```

The line resolves the pointer when a shell starts, so a switch reaches new shells only, and a running session keeps its home. Windows gets the PowerShell profile equivalent. The screen shows the line after the first connect and keeps it reachable from the row overflow. macOS differs by one fact: the credential follows the switch even in a shell without the line, because the keychain item moved. The line still matters there, so the tool's state and history follow the same account as its credential.

The platform split is deliberate. On Linux and Windows, recompose writes nothing outside its own user-data tree, because the vendors document per-home isolation there. On macOS it touches exactly one foreign object, the Claude Code keychain item, because the platform documents no other way. One swap mechanism everywhere would be one code path, but it would write foreign stores on platforms that don't need it. The custody module owns the whole difference behind one seam, and ADR-0069's draft carries the comparison.

### The screen and the drawer

The providers route keeps its kind search parameter and gains `subscription` as its default. The subscriptions surface carries the heading, the subtitle, and either the empty state or the rows. A row reads leading to trailing: brand mark, provider name with the plan badge, the signed-in address, the serves line, the standing chip, and the overflow. The serves line names the tool and whose quota pays. The overflow holds Use this account, Sign in again, Copy shell setup, and Remove. A lapsed row surfaces Sign in again beside the standing rather than only inside the overflow.

The Add provider control opens the catalog in the new `Drawer`, a right-anchored surface on the same Base UI dialog primitive the sheet uses. It carries its heading, a close control at the heading's trailing edge, the search field, the chips, and the grouped rows. The surface behind stays in view, which is what the spec's "beside the surface" scenario demands. The drawer's open state is local component state per ADR-0065, because nothing outside the page opens it.

Picking a provider that connects two ways shows the fork: both arms together, each naming its yield. The sign-in arm says it yields a managed account for the provider's own tool and that usage draws on the plan's own limits. It also names the governing terms and the provider's right to end access without notice. The key arm says it yields a target any gateway can reach, and it opens the key form with the provider preset. The key form is the reworked connect form living inside the drawer, and the standalone form with its kind field retires.

The other two connectable kinds keep their list rows under their own kind parameter, and the drawer becomes the one way to add any account. The `local` kind joins the sidebar with a count of zero and a destination sentence naming that its surface follows.

### Trade-offs in view

The design carries two custody mechanisms, and carries them on purpose. Per-home isolation is the documented path on Linux, Windows, and everywhere Codex runs in file mode. The keychain swap is the only path macOS leaves for Claude Code. The price is a platform branch inside one module, and the alternative price was foreign writes on platforms that need none.

The design also accepts that standing is evidence, not omniscience. A lapse the tool hasn't recorded in the home reads as connected until an observation or a failed restore says otherwise. The honest alternative would be recompose refreshing tokens to find out, which is the exact machinery this change exists to refuse.

## Data model and contracts

### The accounts document, version 2

`packages/contracts/src/accounts.ts` moves to version 2. The kind enum gains `local`, and the row splits by kind.

```ts
export const ACCOUNTS_VERSION = 2;

export const accountKindSchema = z.enum(['subscription', 'api-key', 'aggregator', 'local']);

export const credentialedAccountKindSchema = z.enum(['api-key', 'aggregator']);

const subscriptionAccountSchema = z.strictObject({
  id: nonBlankString,
  provider: subscriptionProviderIdSchema,
  kind: z.literal('subscription'),
  label: z.string().trim().min(1),
});

const credentialedAccountSchema = z.strictObject({
  id: nonBlankString,
  provider: nonBlankString,
  kind: credentialedAccountKindSchema,
  label: z.string().trim().min(1),
  credentialRef: nonBlankString,
});

const accountSchema = z.discriminatedUnion('kind', [
  subscriptionAccountSchema,
  credentialedAccountSchema,
]);
```

The union is the prohibition guard's first half: a subscription row carrying a `credentialRef` fails parse everywhere the document loads: in main, in the renderer, and in every test. The document also refuses a stored `local` row, because no connectable local provider exists yet. The duplicate-id refinement stays.

The migration from 1 to 2 rewrites any version 1 row of kind `subscription` to kind `api-key`, keeping its id, label, and `credentialRef`. The old flat form stored a pasted secret for that kind, and a pasted secret is a key-shaped credential in truth. The migration drops nothing, and after it no subscription row references the vault, which makes the guard hold over old data too.

### The subscriptions module

`packages/contracts/src/subscriptions.ts` opens as the shared vocabulary of providers, tools, and views.

```ts
export const subscriptionProviderIdSchema = z.enum(['anthropic', 'openai']);

export const subscriptionProviders = {
  anthropic: {
    toolBinary: 'claude',
    toolName: 'Claude Code',
    configHomeVariable: 'CLAUDE_CONFIG_DIR',
    signInArguments: [],
  },
  openai: {
    toolBinary: 'codex',
    toolName: 'Codex',
    configHomeVariable: 'CODEX_HOME',
    signInArguments: ['login'],
  },
} as const;

export const subscriptionStandingSchema = z.enum(['connected', 'lapsed']);

export const subscriptionAccountViewSchema = z.strictObject({
  id: nonBlankString,
  provider: subscriptionProviderIdSchema,
  label: z.string().trim().min(1),
  signedInAs: nonBlankString.optional(),
  plan: nonBlankString.optional(),
  standing: subscriptionStandingSchema,
  active: z.boolean(),
});

export const subscriptionToolSchema = z.strictObject({
  provider: subscriptionProviderIdSchema,
  toolName: nonBlankString,
  present: z.boolean(),
  signInCommand: nonBlankString,
  shellSetupLine: nonBlankString,
});
```

`signedInAs` and `plan` stay optional on purpose: the row renders what the tool's record carries and nothing where it doesn't, so an absent field never renders as a guess.

### The channel registry

`ipcChannels` grows from fifteen entries to twenty. `IpcChannel`, `IpcRequest`, `IpcResponse`, and `RecomposeIpc` all derive from the map, so the type surface follows.

| Channel                  | Request                        | Response                                            |
| ------------------------ | ------------------------------ | --------------------------------------------------- |
| `subscriptions:list`     | `z.void()`                     | `ipcResult(z.array(subscriptionAccountViewSchema))` |
| `subscriptions:tools`    | `z.void()`                     | `ipcResult(z.array(subscriptionToolSchema))`        |
| `subscriptions:sign-in`  | `z.strictObject({ provider })` | `ipcResult(z.array(subscriptionAccountViewSchema))` |
| `subscriptions:restore`  | `z.strictObject({ id })`       | `ipcResult(z.array(subscriptionAccountViewSchema))` |
| `subscriptions:activate` | `z.strictObject({ id })`       | `ipcResult(z.array(subscriptionAccountViewSchema))` |

Sign-in and restore travel as two channels rather than one channel with a mode, because the two acts differ in what they create. Connect stages the pending home and appends a row, and restore targets an existing home and appends nothing.

`connectAccountRequestSchema` narrows its `kind` to `credentialedAccountKindSchema`, which is the guard's second half: no channel accepts a secret for a subscription. `ipcErrorSchema` grows from eight codes to eleven with `tool-missing`, `sign-in-timed-out`, and `keychain-denied`.

### Storage contracts

`accounts.json` stays the registry main owns, and subscription mutations join the same write queue the vault mutations use, keeping one writer in one order. The subscription homes live under `subscriptions/<provider>/` beside the other user-data stores, with one `pending` home per provider and one `active` pointer per provider. Each Codex account home starts with a seeded `config.toml` holding `cli_auth_credentials_store = "file"`.

The vault contract doesn't change, because no subscription path opens it. On macOS the parked credentials rest as keychain items named for their account ids, plus one reserved item for the pre-existing login. They rest in the operating-system keychain rather than in the vault, which keeps the proposal's no-vault-entry guard literal. ADR-0069 records the carve-out from ADR-0016's resting rule.

### The type-level specs

`packages/contracts/src/accounts.test-d.ts` opens and pins the guard at compile time: the subscription arm has no `credentialRef` property, the stored row kinds exclude `local`, and `IpcRequest<'accounts:connect'>['kind']` excludes `subscription`. `ipc.test-d.ts` moves its totality assertion to twenty channels and its error-code assertion to eleven members.

## Error handling

| Failure                                           | Representation                                                | The screen shows                                                                |
| ------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| The provider's tool is absent                     | `ok: false`, `tool-missing`, message names tool and remedy    | the fork's sign-in arm carries the reason, and no sign-in begins                |
| The sign-in never completes inside the wait bound | `ok: false`, `sign-in-timed-out`                              | the drawer leaves the waiting state with the sentence and a try-again           |
| No terminal opens for the launch                  | not a failure                                                 | the waiting state's command with its copy affordance, which was showing anyway  |
| The person denies the keychain prompt             | `ok: false`, `keychain-denied`                                | the act stops before any write, and the sentence names what to allow            |
| The `security` tool fails mid-custody             | `ok: false`, `storage-failed`, message names the custody step | the refusal surfaces, and a retry re-reads the vendor item as the single truth  |
| An account's sign-in no longer holds              | `standing: 'lapsed'` inside the view, not an error            | the row's attention chip with the word, and Sign in again on the row            |
| The login-shell path probe hangs or fails         | degraded, not thrown                                          | presence falls back to the plain environment path, and absent stays explainable |
| A home read meets junk or a changed record shape  | absent fields, never a throw                                  | the row renders without the missing field, standing from the remaining evidence |
| `accounts.json` or a home write fails             | `ok: false`, `storage-failed`, message names the operation    | the drawer or row surfaces the refusal sentence                                 |
| A malformed request crosses the bridge            | `ok: false`, `validation-failed`                              | the standard refusal path                                                       |
| A version 2 document meets an older build         | the stepper refuses a newer schema                            | the stored file survives untouched, reported rather than eaten                  |

The vault codes never appear on subscription paths, because those paths never open the vault. That absence is load-bearing and the handler specs assert it.

Three rules bind the handlers. No silent failures: an abandoned sign-in logs its timeout before resolving, and a failed pointer move reports rather than half-switching. Errors carry context: every message names the provider, the tool, or the operation. Expected failures travel as typed values, and a lapse travels as state, because a lapse describes an account rather than refusing an act.

## File map

### Contracts

- `packages/contracts/src/accounts.ts`: version 2, the four-kind enum, the row union, and the migration (modify)
- `packages/contracts/src/accounts.test.ts`: union parses, the local-row refusal, and the migration behavior (modify)
- `packages/contracts/src/accounts.test-d.ts`: the compile-time guard pins (create)
- `packages/contracts/src/subscriptions.ts`: provider ids, the provider table, standing, the view, and the tool report (create)
- `packages/contracts/src/subscriptions.test.ts`: schema behavior specs (create)
- `packages/contracts/src/ipc.ts`: five channels, two codes, and the narrowed connect request (modify)
- `packages/contracts/src/ipc.test.ts`: the roster moves to twenty (modify)
- `packages/contracts/src/ipc.test-d.ts`: totality over twenty channels and eleven codes (modify)
- `packages/contracts/src/index.ts`: re-exports the subscriptions module (modify)

### Main process

- `apps/desktop/src/main/subscriptions/login-shell-path.ts`: the one-shot login-shell `PATH` probe with its bound and fallback (create)
- `apps/desktop/src/main/subscriptions/tool-presence.ts`: resolves each provider's binary on that path and builds the tool report (create)
- `apps/desktop/src/main/subscriptions/subscription-homes.ts`: home paths, the pending home, promote, remove, the active pointer with its junction fallback, and the Codex file-mode seed (create)
- `apps/desktop/src/main/subscriptions/credential-custody.ts`: the macOS park, place, and clear sequencing over an injected keychain seam (create)
- `apps/desktop/src/main/subscriptions/macos-keychain.ts`: the `security` spawn for presence, read, write, and delete, where the presence probe omits `-w` so it never asks for the secret, with the e2e keychain override, shell-thin (create)
- `apps/desktop/src/main/subscriptions/subscription-standing.ts`: the defensive per-provider observer answering standing, address, and plan (create)
- `apps/desktop/src/main/subscriptions/sign-in-launch.ts`: the per-platform terminal open with the e2e launcher override, shell-thin (create)
- `apps/desktop/src/main/subscriptions/subscription-sign-in.ts`: the connect and restore orchestration over injected seams (create)
- `apps/desktop/src/main/subscriptions/*.test.ts`: behavior specs per module, temp directories and fake binaries as the process-boundary doubles (create)
- `apps/desktop/src/main/ipc/subscriptions-ipc.ts`: the five handlers behind the single-flight queue (create)
- `apps/desktop/src/main/ipc/subscriptions-ipc.test.ts`: handler specs against temp storage (create)
- `apps/desktop/src/main/ipc/storage-ipc.ts`: remove branches by kind, deleting the home and healing the pointer for a subscription row (modify)
- `apps/desktop/src/main/ipc/storage-ipc.test.ts`: the branch's round trips (modify)
- `apps/desktop/src/main/ipc/storage-ipc-vault-order.test.ts`: its connect requests narrow to the credentialed kinds (modify)
- `apps/desktop/src/main/storage/accounts-store.test.ts`: its stored fixture moves to version 2 (modify)
- `apps/desktop/src/main/ipc/storage-ipc-secret-hygiene.test.ts`: views never carry token material (modify)
- `apps/desktop/src/main/ipc/dispatch.ts`: `ipcChannelNames` gains five entries (modify)
- `apps/desktop/src/main/ipc/dispatch.test.ts`: the totality assertion follows (modify)
- `apps/desktop/src/main/index.ts`: composes the subscriptions handlers (modify)
- `apps/desktop/src/preload/index.ts`: five bridge entries (modify)

### Renderer, shared

- `apps/desktop/src/renderer/src/shared/ui/drawer.tsx`: the right-anchored container on the Base UI dialog, heading with trailing close (create)
- `apps/desktop/src/renderer/src/shared/ui/chip.tsx`: the filter chip with its selected state on the Base UI toggle (create)
- `apps/desktop/src/renderer/src/shared/ui/badge.tsx`: the small label riding beside a name (create)
- `apps/desktop/src/renderer/src/shared/ui/status-chip.tsx`: the dot beside the word, positive and attention tones (create)
- `apps/desktop/src/renderer/src/shared/ui/overflow-menu.tsx`: the trailing actions menu on the Base UI menu (create)
- `apps/desktop/src/renderer/src/shared/ui/brand-mark.tsx`: the named provider mark set as inline vectors (create)
- `apps/desktop/src/renderer/src/shared/ui/*.stories.tsx`: one story sibling per new component (create)
- `apps/desktop/src/renderer/src/shared/ui/drawer.browser.test.tsx` and `overflow-menu.browser.test.tsx`: focus, dismissal, and action behavior (create)
- `apps/desktop/src/renderer/src/shared/ui/index.ts`: exports the six (modify)
- `apps/desktop/src/renderer/src/shared/api/subscriptions.ts`: the two query options and the three mutations with their invalidations (create)
- `apps/desktop/src/renderer/src/shared/api/index.ts`: the segment exports (modify)
- `apps/desktop/src/renderer/src/shared/testing/fake-bridge.ts`: the five stubs with view and tool seeds (modify)
- `apps/desktop/src/renderer/src/app/styles/theme.css`: the attention pair and the chip tokens (modify)
- `apps/desktop/src/renderer/src/app/styles/primitives.css`: the amber steps the pair draws from, where missing (modify)

### Renderer, entities, widgets, and pages

- `apps/desktop/src/renderer/src/entities/account/model/account-kind.ts`: `AccountKind` rereads from the schema, and the titles gain Local Runtimes (modify)
- `apps/desktop/src/renderer/src/entities/account/model/account-kind.test.ts`: the fourth title and filter behavior (modify)
- `apps/desktop/src/renderer/src/widgets/provider/sidebar/ui/provider-sidebar.tsx`: the fourth row with its glyph and tint (modify)
- `apps/desktop/src/renderer/src/widgets/provider/sidebar/ui/provider-sidebar.browser.test.tsx` and `provider-sidebar.stories.tsx`: follow, including the contrast stories (modify)
- `apps/desktop/src/renderer/src/pages/providers/model/provider-catalog.ts`: the catalog rows, their kinds, their yields copy, and the search and chip narrowing (create)
- `apps/desktop/src/renderer/src/pages/providers/model/provider-catalog.test.ts`: narrowing behavior (create)
- `apps/desktop/src/renderer/src/pages/providers/ui/providers-page.tsx`: the kind-scoped composition (modify)
- `apps/desktop/src/renderer/src/pages/providers/ui/subscriptions-empty-state.tsx`: the call to action and its sentence (create)
- `apps/desktop/src/renderer/src/pages/providers/ui/subscription-account-row.tsx`: the row anatomy with the on-row restore (create)
- `apps/desktop/src/renderer/src/pages/providers/ui/provider-catalog-drawer.tsx`: search, chips, grouped rows, and the waiting state (create)
- `apps/desktop/src/renderer/src/pages/providers/ui/provider-connect-fork.tsx`: the two arms with their yield, terms, and quota copy (create)
- `apps/desktop/src/renderer/src/pages/providers/ui/connect-key-form.tsx`: the key arm's form with the provider preset, superseding the standalone form (create)
- `apps/desktop/src/renderer/src/pages/providers/ui/local-runtimes-note.tsx`: the fourth destination's sentence (create)
- `apps/desktop/src/renderer/src/pages/providers/ui/*.stories.tsx` and `*.browser.test.tsx`: siblings for every new component, red-first from the existing page spec (create)
- `apps/desktop/src/renderer/src/pages/providers/ui/connect-account-form.tsx`, `account-kind-field.tsx`, and their tests and stories: retire (delete)
- `apps/desktop/src/renderer/src/app/routes/providers.tsx`: `subscription` becomes the default kind, and the loader warms the two subscription queries (modify)

### End to end, records, and repository files

- `apps/desktop/e2e/features/providers/`: the four approved features from this change's `gherkin/` folder, replacing `accounts.feature`'s connect path (create and modify)
- `apps/desktop/e2e/steps/providers.steps.ts`: drawer, fork, sign-in, and standing steps by role and name (modify)
- `apps/desktop/e2e/fixtures.ts`: the fake tool binaries on a prepended path, the sign-in launcher override, and the keychain override (modify)
- `apps/desktop/e2e/visual.spec.ts-snapshots/`: providers-empty and providers-connected regenerate on all three platforms (modify)
- `README.md`: line 31 rewrites around delegation and keys (modify)
- `cspell-words.txt`: any new provider vocabulary the diff introduces (modify)
- `docs/adr/0069-subscriptions-delegate-to-the-providers-tool.md` and `docs/adr/README.md`: land at implementation from the draft below (create)

`apps/desktop/stryker.config.json` gains `sign-in-launch.ts` and `macos-keychain.ts` in its shell excludes, beside `spawn-engine.ts`. The custody sequencing stays mutated. No new lefthook lane lands, because the guard is structural.

## Interfaces

### Contracts

- Consumes: `zod`, `nonBlankString`, `ipcResult`, and the migration stepper.
- Produces:
  - `ACCOUNTS_VERSION` at 2, `accountKindSchema` with four members, `credentialedAccountKindSchema`, and the row union inside `accountsDocumentSchema`
  - `subscriptionProviderIdSchema`, `SubscriptionProviderId`, and the `subscriptionProviders` table
  - `subscriptionStandingSchema`, `subscriptionAccountViewSchema`, `SubscriptionAccountView`, `subscriptionToolSchema`, and `SubscriptionTool`
  - `IpcChannel` widened to twenty members and `IpcError['code']` widened to eleven
- Narrowing the row union: the credentialed arm keys on an enum rather than on two literal arms, so `Extract<Account, { kind: 'api-key' }>` answers `never`. Reach for the exported `CredentialedAccount`, or for `Extract<Account, { kind: CredentialedAccountKind }>`. A runtime check narrows the same way, so `row.kind !== 'subscription'` gives you the credentialed arm.

### Main

- Consumes: the contracts surface, `node:child_process`, `node:fs/promises`, and the storage stores.
- Produces:
  - `loginShellPath(): Promise<string>` with its timeout fallback to the process environment
  - `reportTools(userData: string, path: string): Promise<SubscriptionTool[]>`
  - `subscriptionHomes(userData: string)` answering `homeFor(provider, id)`, `pendingHomeFor(provider)`, `promotePending(provider, id)`, `removeHome(provider, id)`, `pointActiveAt(provider, id)`, and `readActive(provider)`
  - `observeSubscription(provider: SubscriptionProviderId, home: string): Promise<{ standing: 'connected' | 'lapsed'; signedInAs?: string; plan?: string }>`
  - `launchSignIn(command: string, cwd: string): Promise<void>` as the shell-thin terminal open
  - `credentialCustody(keychain: KeychainSeam)` answering `park(provider, slot)`, `place(provider, slot)`, `clear(provider)`, and `parkedStands(slot)`, where a slot names an account id or the reserved pre-existing login
  - `createSubscriptionsIpcHandlers(ctx): Pick<IpcHandlers, 'subscriptions:list' | 'subscriptions:tools' | 'subscriptions:sign-in' | 'subscriptions:restore' | 'subscriptions:activate'>`

### Renderer

- Consumes: the twenty-channel bridge, `unwrapIpcResult`, `refusalSentence`, and the kit.
- Produces:
  - `shared/api`: `subscriptionsQueryOptions`, `subscriptionToolsQueryOptions`, `useSignInSubscription()`, `useRestoreSubscription()`, and `useActivateSubscription()`
  - `shared/ui`: `Drawer({ open, onOpenChange, title, children })`, `Chip({ selected, onSelectedChange, children })`, `Badge({ children })`, `StatusChip({ word, tone })`, `OverflowMenu({ label, items })`, and `BrandMark({ name })`
  - `pages/providers`: `ProvidersPage({ kind })` through the slice's public interface, unchanged for the route

## Decisions

### 1. The catalog's container is a new kit drawer, not a bent sheet

The repository holds no inspector container, so this change builds the one the reference names, as `shared/ui/drawer.tsx` on the same Base UI dialog primitive the sheet uses. The sheet stays a centered surface that takes one decision through a mandatory footer. The catalog is a browse surface with a search field, chips, grouped rows, and a close control in its heading, and it settles nothing on close. Bending one component across both anatomies would need a placement switch and a footer switch, which is the flag-parameter shape the clean-code rules split. Building the drawer now also means the future inspector borrows a shipped container instead of this change borrowing a missing one.

**Alternatives considered:** extending `Sheet` with a side variant, rejected as two anatomies behind one prop. Building the drawer inside the page, rejected because the proposal names it as the inspector's container, which makes it kit infrastructure by intent.

**ADR draft:** None. ADR-0044 owns the primitive layer, and this follows it.

### 2. The accounts registry stays `accounts.json`, at version 2, with a kind-split row

The registry a subscription row lands in already exists, and ADR-0016 fixes its owner. What changes is shape: the row becomes a union in which only credentialed kinds carry a `credentialRef`, and the enum gains `local` without admitting a stored `local` row. Identity is all the document stores for a subscription, because everything else is observation. ADR-0062's rule forces the version bump: a subscription row without a `credentialRef` fails the version 1 parse, so the shape change earns version 2 and its migration.

**Alternatives considered:** a separate subscriptions document, rejected because the sidebar counts one registry and a second file splits one fact across two owners. A nullable `credentialRef` on one flat row, rejected because it makes the prohibited state representable and moves the guard into prose.

**ADR draft:** carried inside draft 3, which owns the storage posture.

### 3. Sign-in and renewal delegate to the provider's tool, and credential custody follows each platform's documented limit

This is the change's architectural decision, and it lands as ADR-0069. The draft follows.

**Context.** Anthropic forbids third parties to offer a claude.ai login or to route requests through plan credentials, and enforces it on the wire. The account switchers beside Claude Code stay permitted because they never make an inference request. The authentication page stores macOS credentials in the encrypted keychain and scopes the `.credentials.json` relocation under `CLAUDE_CONFIG_DIR` to Linux and Windows. The machine shows one item, service `Claude Code-credentials`, account attribute the operating-system user, shared across config homes. Codex documents `cli_auth_credentials_store`, where `file` keeps `auth.json` under `CODEX_HOME`. The defect record around held credentials is consistent: rotated refresh tokens restored stale, concurrent refreshes invalidating live sessions, and corrupted bundles after transient failures.

**Decision.** A subscription account is a directory recompose owns and the provider's tool fills. Sign-in and renewal run inside the tool, launched with the config-home variable aimed at the account's directory. recompose stores identity in `accounts.json`, observes standing without extracting token material, and switches accounts by moving one `active` link per provider. Credential custody follows the platform. Claude Code on Linux and Windows, and Codex in seeded file mode everywhere, keep the credential inside the account's home, and recompose never touches it. Claude Code on macOS keeps one keychain item per operating-system user. A switch therefore parks the resident blob whole under the outgoing account, then places the incoming account's blob. The order stands fixed: park before place, pointer last. recompose never refreshes a credential, never spends one, and never edits a blob.

**Alternatives.** Config-home isolation alone, rejected: the documented platform limit on macOS leaves one shared keychain item, so a second sign-in would overwrite the first. Running an authorization flow in recompose, rejected: prohibited for the flagship provider, and it recreates the rotation split-brain for a credential recompose can't spend. The full store swap on every platform, one mechanism everywhere, rejected: it writes foreign stores where the vendors document per-home isolation, and multiplies the custody surface for nothing. Spawning the tool as a hidden child to scrape its status, rejected: the sign-in is interactive and a terminal the person can see is the honest surface for it.

**Consequences.** **Good**: only the tool ever refreshes a credential, and a parked blob's refresh token sits unused, so the recorded rotation races can't occur. The person's file stores under `~/.claude` and `~/.codex` stay untouched. The prohibition holds structurally, because no schema can store a subscription credential reference. **Bad**: macOS custody writes one foreign keychain item, prompts the person for access, and makes the machine-wide Claude Code login follow the active account. Parked credentials rest in the operating-system keychain, a recorded carve-out from ADR-0016's resting rule. A parked login can pass its hard lifetime unnoticed, and standing can lag the truth.

**ADR draft:** `docs/adr/0069-subscriptions-delegate-to-the-providers-tool.md`, from the text above.

### 4. Tool presence resolves in main, through the login shell's path

Only main spawns processes under ADR-0016, so the check lives in `main/subscriptions/`. A windowed launch on macOS carries a minimal `PATH` without the directories package managers install into, so a plain environment lookup would report every tool absent. Main therefore probes the person's login shell once per run, bounded by a timeout, and resolves each provider's binary against that path. The probe degrades to the process environment when it fails, so a broken shell profile explains rather than breaks.

**Alternatives considered:** checking in the renderer, impossible behind the sandbox. Checking well-known install paths, rejected as a list that rots per platform and package manager. Asking the person to state the path, rejected because the machine already knows.

**ADR draft:** carried inside draft 3.

### 5. Sign-in resolves as one long-lived invoke, and the terminal launch is best effort

The sign-in channel answers when the tool has finished. The drawer's pending state therefore needs no event surface, no polling loop in the renderer, and no second source of truth. The waiting state always shows the exact command with a copy affordance. The terminal open can therefore fail without stranding anyone, and the manual path exists on every platform for free. A wait bound turns abandonment into `sign-in-timed-out`.

**Alternatives considered:** a start-then-push shape over a new event map entry, rejected because one consumer with one pending state doesn't earn a push surface. Renderer polling of the list during the wait, rejected as a second completion authority beside main's watcher.

**ADR draft:** None.

### 6. The catalog, the fork, and the rows stay in the providers page slice

One page consumes them, so FSD's start-simple rule keeps them in `pages/providers`, with the catalog data in the slice's `model` segment. The kit pieces they compose from live in `shared/ui`, because a chip, a badge, a drawer, and a menu are infrastructure with no business meaning. Nothing moves to `widgets` or `entities` until a second consumer exists.

**Alternatives considered:** a catalog widget, rejected because only this page opens it. A provider entity, rejected because the catalog rows are static data one page reads.

**ADR draft:** None. ADR-0010 governs placement.

### 7. Standing carries two states, and both mean their remedy

`connected` and `lapsed` are the whole vocabulary, because the row's only remedy is signing in again through the tool. Evidence the observer can't read collapses toward `connected` when the account record stands, and toward `lapsed` when it doesn't or when positive signed-out evidence exists. A third state would name uncertainty without changing what the person does next.

**Alternatives considered:** a `Missing scopes` style third state from the field references, rejected because no scope machinery exists here. An `unknown` state for unreadable homes, rejected because its row would carry the same button with a vaguer word.

**ADR draft:** None.

### 8. Removal deletes the account's home, and the pointer heals

`accounts:remove` branches by kind. A credentialed row deletes its vault entry as today. A subscription row deletes its config home and, on macOS, its parked keychain item. A removed active account also clears the vendor item, then hands the pointer to the provider's remaining account, or the pointer leaves with it. Removing the last account writes the reserved pre-existing login back, so the machine ends where it began.

**Alternatives considered:** keeping the home for a later reconnect, rejected because a removed account that still holds a live credential isn't removed.

**ADR draft:** carried inside draft 3.

### 9. The prohibition guard is structural, not a new hook lane

The proposal asks for a checkable guard in the spirit of the alias and protected-branch guards. It lands as contract structure plus pinned specs. The version 2 union can't store a subscription credential, and the connect request can't accept one. The type-level spec fails compilation if either loosens, and the e2e catalog scenario asserts the sign-in arm never names a gateway. A schema every process parses is a stronger guard than a pattern a hook greps for, and the existing test lanes already run before every commit and push.

**Alternatives considered:** a lefthook grep for login-flow markers, rejected as a pattern list that can't see a schema loosening, which is the actual risk. A gitleaks rule, rejected because the vault is runtime state and gitleaks scans the repository.

**ADR draft:** None. ADR-0011 already records why machine-checked beats prose, and this applies it.

## Test matrix

| Layer          | What this layer proves (or why none)                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Check command                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Unit           | In contracts: the row union admits and refuses the right shapes, the migration rewrites version 1 subscription rows to keys, and a local row stays refused. In main: the standing observer's evidence table, the tool report over a fake path, the pointer move and heal, and the catalog narrowing in the page's model. Browser-mode specs cover the drawer, the chips, the row states, the fork copy, and the empty state over the fake bridge.                                          | `pnpm run test`                                                                                                 |
| Integration    | The handlers against real temp storage: sign-in stages, watches a home a fake tool binary fills, promotes, and appends. Restore targets an existing home. Activate moves the pointer and survives a removed target. Custody parks before it places against a fake keychain seam, and a denied prompt aborts before any write. Remove deletes the home, the parked item, and heals the pointer. Dispatch registers all twenty channels, and no response carries token material.             | `pnpm run test`                                                                                                 |
| End-to-end     | In the real shell with fake tool binaries on a prepended path and the launcher override: the four approved features run. The empty state explains, the catalog opens beside the screen and narrows, the fork names both yields, sign-in appends the row with its address and plan, an absent tool states its reason, and a lapsed seed shows the on-row way back. The never-a-target scenario asserts the app offers no compose surface carrying one.                                      | `pnpm run test:e2e` and `pnpm --filter @recompose/desktop run test:e2e:visual`                                  |
| Property       | Any valid version 1 document migrates to a valid version 2 document with ids preserved and no subscription row referencing the vault. The standing observer never throws on arbitrary bytes in any record file, and never answers `connected` without an account record. Catalog narrowing always answers a subset of its input, for any search text and chip. The custody sequence never overwrites the vendor item before parking it, for any account pair and any single failure point. | `pnpm run test`                                                                                                 |
| Mutation scope | Two diff-scoped gates. The contracts gate mutates the accounts and subscriptions modules at break 77. The desktop gate mutates `src/main/**` and `scripts/**` at break 81, which reaches the presence check, the homes and pointer, the observer, the orchestration, and the handlers, with `sign-in-launch.ts` joining the shell excludes. The gate doesn't reach the renderer, so the drawer, chips, rows, and catalog narrowing rest on the browser and property layers instead.        | `pnpm --filter @recompose/contracts run test:mutation` and `pnpm --filter @recompose/desktop run test:mutation` |

### Designated mutant killers

| Invariant                                            | Mutant killer                                                                    |
| ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| The migration rewrites exactly the subscription rows | the round-trip property plus per-kind examples in `accounts.test.ts`             |
| No view ever carries token material                  | the hygiene assertions over seeded homes in the secret-hygiene spec              |
| `connected` requires credential evidence             | the never-connected-without-evidence property in `subscription-standing.test.ts` |
| The pointer never dangles after a remove             | the heal examples in `storage-ipc.test.ts` and `subscription-homes.test.ts`      |
| Presence falls back rather than throwing             | the timeout and broken-profile examples in `login-shell-path.test.ts`            |
| Park happens before place, pointer last              | the ordering and failure-point examples in `credential-custody.test.ts`          |

## Task decomposition hooks

Tasks run in parallel by default. A dispatch serializes only for a named blocker: one task reads what another produces, two tasks own the same file, or one inspects what another writes. Every dispatch names its files and states that the others run on disjoint files.

- Task 1: contracts (depends on: none, hands off: the version 2 document, the subscriptions module, and the twenty-channel surface). Owns `packages/contracts/src/`.
- Task 2: the kit and the tokens (depends on: none, hands off: `Drawer`, `Chip`, `Badge`, `StatusChip`, `OverflowMenu`, `BrandMark`, and the attention pair). Owns the six `shared/ui` components with stories and both style files. Runs beside task 1 on disjoint files.
- Task 3: main (depends on: task 1, reads its schemas, hands off: the five handlers behind the bridge). Owns `apps/desktop/src/main/subscriptions/`, the handler and dispatch files, `apps/desktop/src/main/index.ts`, both preload touches, and the Stryker exclude line. Runs beside task 4 on disjoint files.
- Task 4: the renderer surface (depends on: task 1 for types and task 2 for kit pieces, hands off: the kind-scoped page over the fake bridge). Owns `pages/providers/`, `entities/account/`, the sidebar widget files, `shared/api/`, `shared/testing/fake-bridge.ts`, the Storybook bridge decorator, and the providers route.
- Task 5: acceptance and records (depends on: tasks 3 and 4, because it inspects the running app they produce, hands off: the merged branch evidence). Owns `apps/desktop/e2e/`, the visual baselines, `README.md`, `cspell-words.txt`, and ADR-0069 with its index row.

## Risks

- [Risk] A tool release changes its record shapes and standing goes blind → Mitigation: the observer parses defensively with absent-means-absent, its fixtures come from captured real records, and a blind field degrades one badge rather than the row.
- [Risk] A parked blob goes stale → Mitigation: the swap parks the freshest blob at the moment it leaves the vendor item, and a parked refresh token sits unused. Unmitigated: the login's hard lifetime can pass while parked, and the row then reads lapsed with its way back.
- [Risk] The keychain prompts read as an attack → Mitigation: the connect and switch copy name the prompt before it appears, and a denial becomes the typed `keychain-denied` refusal before any write. Unmitigated: the prompts themselves, including one the tool may raise after recompose rewrites the item.
- [Risk] A crash lands between park and place → Mitigation: park before place, pointer last, single flight, and a retry re-reads the vendor item as the single truth. Unmitigated: the one-step window itself.
- [Risk] The vendor renames the keychain service or reshapes the blob → Mitigation: custody treats the blob as opaque bytes and fails loud with the custody step named. Unmitigated: a rename breaks switching until a release follows it.
- [Risk] A switch lands under a live session → Mitigation: the shell line resolves the pointer at shell start, so a running session keeps its home, and the switch copy warns on macOS. Unmitigated: recompose can't see a live session, and a live macOS session meets the swapped credential at its next keychain read.
- [Risk] A person never wires the shell line and reads the switch as broken → Mitigation: the connect success panel and the row overflow both carry Copy shell setup. Unmitigated: a shell without the line keeps its old account on Linux and Windows, while on macOS the credential follows anyway and the state lags.
- [Risk] The login-shell probe hangs on a broken profile → Mitigation: a bounded timeout falls back to the process environment, and the absent report says which lookup failed.
- [Risk] No terminal opens on an unusual Linux setup → Mitigation: the launch is best effort and the waiting state always shows the command with copy.
- [Risk] Two sign-in attempts race one pending home → Mitigation: one pending home per provider behind the single-flight queue, reset at each attempt's start.
- [Risk] The switch behavior has no delta-spec scenario → Mitigation: the proposal binds it, unit and integration specs pin it, and the maintainer can add a scenario at task cut.
- [Risk] The never-a-target scenario outruns the missing compose surface → Mitigation: the contract-level authority lands now, and the e2e step asserts the stronger absence of any compose offer.
- [Risk] Windows link semantics differ → Mitigation: the pointer uses a directory junction, which needs no privilege, and the homes module owns the platform branch behind one name.
- [Risk] The fake tool binaries drift from the real tools → Mitigation: the e2e proves recompose's side of the contract, and the observer's own fixtures pin the real record shapes.

## Migration and rollout

**Deploy.** One release carries the whole change, nothing behind a flag. No release of recompose has shipped, so the population of stored documents is developer machines.

**The accounts document moves to version 2.** The migration from 1 to 2 rewrites any stored `subscription` row to `api-key`, keeping its id, label, and `credentialRef`, and passes every other row through. The old flat form could store that combination, so the migration is real rather than ceremonial, and a fast-check property proves the round trip. After migration, no subscription row references the vault, which the guard requires of old data too.

**Rollback.** A checkout from before this change refuses a version 2 document as newer than supported, which the stepper already does. The storage layer reports the refusal rather than repairing anything. The file survives untouched. Subscription homes under `subscriptions/`, seeded Codex configs, and parked keychain items are all inert to an older build.

**What retires.** The standalone connect form, the kind field, and their stories and specs leave. The connect scenario in `accounts.feature` rewrites around the drawer's key arm. The providers-empty and providers-connected baselines regenerate on all three platforms.

**Records that move in step.** `README.md` line 31 stops promising OAuth sign-in and starts naming delegation and keys. ADR-0069 lands from the draft in decision 3, with its index row. Any new provider vocabulary joins `cspell-words.txt` in the same diff that uses it.

## Open questions

- **Where each tool's records carry the signed-in address and the plan, per platform.** The observer renders what it finds and stays silent otherwise. Captured records during implementation settle it without moving any boundary.
- **The Linux terminal launcher order.** The launch module tries the common launchers and degrades to the always-present command display. The precise list lives inside one shell-thin file and moves nothing else.
- **Whether Codex's `auto` store resolves to the keyring on macOS, and how its keyring entry maps to a home.** This machine holds both `auth.json` and a `Codex Safe Storage` keychain item, so neither answer is establishable from here. The seeded file mode makes both moot for recompose's homes, and one observed sign-in during implementation settles them.
- **Whether plain `claude` on macOS reconciles its default state with a swapped credential on its own.** Observation during implementation settles it, and the shell line stays the recommended wiring either way.

## End-to-end verification

Run the desktop app from `apps/desktop` with `pnpm dev`, with `claude` installed and `codex` absent, then walk the loop.

1. The sidebar shows four destinations. Subscriptions opens as the default providers surface with the heading, the subtitle, and the empty state naming what a subscription is over one call to action.
2. Add provider opens the drawer beside the screen. The list stays visible behind it, the search field takes focus, and the chips narrow the grouped rows to one kind and back.
3. Picking Anthropic shows both arms. The sign-in arm names the managed account, the tool it serves, the plan quota, the governing terms, and the without-notice revocation. The key arm names the gateway target. Neither names a step count.
4. Choosing sign-in raises the keychain prompt the copy announced, then opens the terminal running Claude Code against the account's home, with the drawer waiting and the command showing. Completing the login in the terminal lands the row: mark, name, plan badge, address, Serves Claude Code, and a Connected chip with a dot beside the word.
5. The success panel offers the shell setup line and says the machine-wide login now follows the active account. In a fresh shell carrying the line, `claude` runs as the connected account, and the pre-existing login sits parked in the reserved item.
6. Picking OpenAI shows the sign-in arm carrying the missing-tool sentence and its remedy, and no sign-in begins. The key arm still works.
7. Signing out inside the tool and reopening the screen flips the row to the attention chip with the lapse word, and Sign in again sits on the row itself. Running it restores Connected.
8. With two Anthropic accounts, Use this account parks the outgoing blob, places the incoming one, and moves the pointer. The rows swap their active marker, and a fresh `claude` anywhere runs as the incoming account.
9. Remove deletes the row, its home, and its parked item, then heals the pointer. Removing the last account writes the reserved login back, and the machine signs in as it did before recompose. Nothing under `~/.claude` or `~/.codex` changed at any point.
10. Both schemes get the `claude-in-chrome` pass: the standing chips, the plan badge, the chips' selected state, and the drawer edge measured from the page.

A fresh-context reviewer diffs the result against these criteria:

- `accountsDocumentSchema` sits at version 2 with the kind-split union, the migration, and the four-member enum, and `accounts.test-d.ts` pins the guard.
- `ipcChannels` holds twenty entries, `ipcChannelNames` matches, the preload bridge matches, and the error codes number eleven.
- No subscription path opens the vault, no response carries token material, and the hygiene spec asserts both.
- Outside its own user-data tree, main touches exactly one foreign object, the Claude Code keychain item on macOS, and only inside the custody module.
- The six kit components ship stories, `pnpm run lint:stories` passes, and `pnpm run lint:fsd` accepts every placement.
- The four approved features pass with the fake tools, the visual baselines regenerate on three platforms, and the README line matches what ships.
- ADR-0069 lands from the draft in decision 3, and the index carries its row.
