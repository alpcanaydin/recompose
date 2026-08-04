# Aggregators and local runtimes, and the last two destinations

## Why

The providers surface promises four destinations, and two of them keep the promise in full. Aggregators stands closest to done: OpenRouter already connects through the key machinery the API Keys change shipped. Yet no living contract states what an aggregator account is, its catalog stands alone with no Soon entries, and its mark is a boxed letter. Local Runtimes stands further away: the destination routes to a placeholder note, and the account document refuses to store a local row at all. This change makes both destinations live up to the sidebar, in the design language the first two set.

The two kinds also each break an assumption the shipped records rest on. Architecture Decision Record (ADR) 0070 proves a key against one first-party host. An aggregator's one key reaches many hosts through a catalog OpenRouter serves without authentication, so a models probe would bless a garbage key. The honest row offers no check. ADR 0069 gives only the credentialed kinds a `credentialRef`, and a local runtime holds no credential at all, only an address that answers or doesn't. Each break gets its own contract, so the registry states what it stores, what it observes, and what it never asks for.

## What changes

**The Aggregators catalog offers seven entries, and one of them connects.** OpenRouter asks for a name and a key in the anatomy the API Keys destination ships, and the stored account keeps the existing `aggregator` kind. Together AI, Fireworks AI, Groq, DeepInfra, Cerebras, and a Custom aggregator escape hatch stand inert under Soon badges. An inert entry stands visible rather than hidden, so the catalog says where it grows.

**The destination's subtitle widens to match its cards.** Five of the Soon entries host their own open-model catalogs rather than routing to other providers, so the shipped line about reaching many providers would overpromise for them. The subtitle becomes the design's own sentence: one key, many models, routed through a hosted catalog. Each Soon card carries an honest benefit line. Together AI reads an open-weights catalog, Fireworks AI fast open-model inference, and Groq the lowest latency on its own silicon. DeepInfra reads a low-cost open-model catalog, Cerebras wafer-scale speed, and the Custom entry any hosted catalog behind one key. What kind each stores when it earns a contract stays that later change's question.

**An aggregator row claims no single host and offers no check.** The row reads the two-line key anatomy: the product title, then the name beside the masked tail. No Verify act stands anywhere on or behind the row. The reason is scope: a models probe can't answer about this key, because OpenRouter serves that catalog to anyone. The vendor's credential-scoped endpoint returns spend and limit data this surface has nowhere to put yet. So the row offers no check in this change, rather than half of one. The family rule underneath is worth stating once: a row carries a standing exactly when recompose can observe one without spending. That rule gives the subscription row its chip, gives the local row its chip, and leaves the key and aggregator rows quiet.

**The key field learns OpenRouter's shape.** The empty field hints the `sk-or-v1-` prefix the way the first-party forms hint theirs, and the shipped shape recognizer learns it. The coverage runs one way, named here so nobody assumes symmetry. An OpenRouter-shaped key pasted into a first-party field now warns. A first-party key pasted into the OpenRouter field warns only where the recognizer knows that vendor's shape. The recognizer's return widens past the first-party id set. The warning still never refuses: a key shaped like another vendor's warns and connects, exactly as the api-keys contract grants.

**The Local Runtimes catalog offers five entries, and one of them connects.** Ollama becomes detectable at its documented localhost address and addable as an account with no credential. LM Studio, llama.cpp, vLLM, and a Custom local server escape hatch stand inert under Soon badges beside it. Each carries its own benefit line: the local server on its known port, the llama-server port, high-throughput GPU serving, and anything serving models on a local port. The placeholder note that said the destination arrives later retires.

**Detection fires on entry, and recompose stores nothing until the person decides.** Picking Ollama looks at once, and no button asks permission to look. The shipped sign-in step set this precedent: it reads the machine on entry and reports what it found, and the detect step inherits that grammar. The step has three faces, and its height changes exactly once. Looking reads a quiet Checking line in the slot the verdict will fill, so the sheet never jumps twice. An answer reads "Ollama is running at 127.0.0.1:11434." with the version the runtime returned beneath. Silence reads "Ollama isn't running at 127.0.0.1:11434. Start it, then check again." On an answer the footer's primary is Add. On silence the primary is Check again, and Add anyway stands beside it as a plain act. Deciding includes adding a server the person will start later, and the default on a failed look must never be a write.

**A local account joins the registry as its own union arm, and it holds no credential.** The `local` arm stores the runtime and its canonical address, `http://127.0.0.1:11434` for Ollama, and nothing else. It carries no label, because the runtime's name is the row's name, and no `credentialRef`, because nothing exists to reference. The arm parses as a `strictObject`, so a credential on a local row is a parse error rather than a review note, the mechanism ADR 0069 set. `ACCOUNTS_VERSION` moves from 3 to 4 with a no-op migration, so an older build refuses the newer document readably instead of quarantining it. The contracts commit lands first and alone, before anything can mint a local row.

**The renderer never supplies an address.** The main process mints the stored address from a contracts-owned table. No row can ever hold `localhost`, the host behind the recorded defect where Node resolves it to IPv6 while Ollama listens on IPv4.

**Reachability speaks its own three verdicts, disjoint from the key-check triad.** `answers` carries the version Ollama's version endpoint returns. `unrecognized` names an HTTP answer that isn't a version body, and it carries the status, so a stranger squatting the port never reads as Ollama. `unreachable` means nothing answered. The engine child mints the verdicts, including the transport reading, and main folds a dead child to `unreachable`. Nothing stores a verdict, and a remount forgets the reading.

**Each verdict owns one word, one tone, and one token, stated here so nobody decides it at the keyboard.** `answers` reads Running on the positive tone over `bg-running`. `unreachable` reads Not running on a new inert tone, a tertiary-ink dot beside the standard secondary word ink. A stopped loopback server is a quiet fact rather than an alarm. `unrecognized` reads Another server answered on the attention tone, because it's the one standing a person must act on differently. The in-flight reading shows Checking on the inert tone with no dot. The status chip gains the one inert tone, and nothing borrows a neighbor's color.

**The probe lives in the engine child, beside the key probe.** The home ADR 0070 chose holds: a fetch-injected module behind the parent-port directive. It sends GET `/api/version`, refuses redirects, and carries its own short bound of about three seconds, because a loopback answer arrives fast or not at all. The contract parse admits loopback origins only, so the probe can never aim off the machine.

**Three channels carry the local path, and none of them can hold a secret.** `accounts:connect-local` takes only the runtime id, and no secret field exists in its schema, so a local account with a secret is impossible by construction. `accounts:detect-runtime` answers from the documented address before anything stores. `accounts:check-runtime` answers from the stored row's address. The local path never opens, touches, or imports the vault.

**A stored row reads the runtime over its address, and its standing is an observation.** The row reuses the subscription row's anatomy: a name over a second line, a dot beside a word at the trailing edge. The second line carries the stored address in the mono value style the masked tail already wears. The version stays on the detect step, so the row keeps two lines. The row re-reads the standing on every mount and on every Check again, and never persists it. A server that stopped after the last look reads Not running at the next one, and the stored address never changes underneath it. The account list suspends and the standing doesn't: rows render at once with a Checking chip and settle one by one, so a slow look never blanks the page.

**A mark for a vendor, a glyph for a category.** Every vendor entry, connectable and Soon alike, draws its real mark across all four destinations, subscriptions and API keys included. The marks come from the `@lobehub/icons` package: tree-shakable React components under the `MIT` license, with mono and color variants. The package covers every vendor in the catalog except llama.cpp, which publishes no mark and keeps its server glyph. The three Custom entries are categories rather than vendors, so each keeps the shared network glyph, and that's the rule rather than an exception. The letter monogram retires. Affordance stays legible without dimming. A connectable card draws the color variant, a Soon card draws the mono variant on tertiary ink at full opacity, and the Soon badge stops inheriting a faded subtree. The mark-name type stops standing in for the connectable-provider type, because Soon cards now carry marks too. The dependency and the trademark stance, nominative use to identify the services recompose connects to, get their own decision record.

**The shipped design language carries most of this, and two patterns are new.** The sheet-hosted catalog flow, the two-line account row, the dot-plus-word standing, and the Soon badge all exist and serve unchanged. The local row is the subscription row's anatomy with a host on its second line, not a new grammar. The detect step is new as a step, though it inherits its habit: the sign-in step already reads the machine on entry without asking. The real-logo mark is new: vendor marks replace monograms everywhere a vendor stands.

**What this change leaves out, on purpose.**

- No editable base URLs: main mints the one documented address, and no field accepts another.
- No optional tokens: a local row can't hold a credential, and no form asks for one.
- No model enumeration and no pickers: a row says the server answers, never what it serves.
- No gateway routing targets: neither kind becomes routable here, so composition stays a later change.
- No stored standing: a reading dies with the screen, so no row carries a stale claim.
- The Soon entries stay inert: each waits under its badge until its contract exists.
- No port sweep: the probe only ever calls the one documented address.

## Capabilities

### New capabilities

- `aggregators`: what the catalog offers and connects, how an OpenRouter key stores under the `aggregator` kind, and why the row claims no single host and offers no check.
- `local-runtimes`: what the catalog offers, how detection precedes adding, what a credential-free account stores, and how a row reads its standing as an observation the registry never keeps.

### Modified capabilities

- None. The `api-keys` contract already grants the warning this change extends: a key shaped like another vendor's may warn and must still connect, and teaching the recognizer one more shape changes no sentence. The `subscriptions` contract asks each row to carry the provider's mark, and a real logo satisfies that sentence better than a monogram did.

## Impact

- `packages/contracts` gains the `local` union arm, the canonical address table, the reachability verdicts, the three local channels, and the `sk-or-` shape. `ACCOUNTS_VERSION` moves from 3 to 4, and this commit lands first and alone.
- `packages/engine` gains the reachability probe beside the key probe, behind the same parent-port directive.
- The main process mints the stored address, serves the three local channels without opening the vault, and folds a dead child to `unreachable`.
- `apps/desktop/src/renderer/src/pages/providers/` gains the aggregator Soon list, the detect step, and the local surface with its row, and loses the placeholder note.
- `apps/desktop/src/renderer/src/shared/ui/brand-mark/` rebuilds over `@lobehub/icons`, and every destination that draws a mark redraws.
- The sidebar's Local Runtimes count starts moving the moment the contract stores a local row, with no change of its own.
- `docs/adr/` gains three records: the local runtime account, the aggregator that offers no check, and the brand-icons dependency with its trademark stance.
- The e2e providers features gain a loopback runtime stub beside the key-probe stub, the catalog count assertions shift, and the visual baselines that show a mark change everywhere.
