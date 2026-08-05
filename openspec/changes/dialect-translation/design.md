# Dialect-translation design

## Header and change linkage

- Change id: dialect-translation
- Schema: recompose
- Proposal: [proposal.md](proposal.md)
- Specs: [specs/dialect-translation/spec.md](specs/dialect-translation/spec.md)
- Discovery: [discovery/brainstorm-decisions.md](discovery/brainstorm-decisions.md), [discovery/research.md](discovery/research.md), [discovery/code-map.md](discovery/code-map.md), [discovery/rider-ledger.md](discovery/rider-ledger.md)
- Tasks: the task decomposition below cuts tasks.md after this design lands.

## Context

A gateway serves both dialects at one address, and a request reaches only a target that speaks its own dialect. The failover ladder that holds a Claude subscription above an OpenAI key stays a diagram until an OpenAI-dialect client reaches the Anthropic target. Translation turns that mixed ladder into a running path. The maintainer wants Codex served now, and Codex speaks the Responses dialect alone since its Chat Completions removal, so the translator answers three dialects rather than two.

Every proxy that tries this breaks at one seam. Anthropic holds a strict schema, and the OpenAI dialects tolerate a loose history, so a field the translation drops becomes a production 400 with nothing on screen to explain it. This change owes a discipline before it owes a mapping. Every field meets a named fate, and nothing vanishes without a trace.

The design turns the locked decisions into a directory, types, codecs, tests, and task boundaries. Anthropic Messages becomes the hub every dialect folds through. Each dialect grows a decoder into the hub and an encoder out of it. The library stays engine-internal and pure, and the serving path stays untouched. The parked gateway-virtual-models change consumes the library when it resumes. This document uses Architecture Decision Record (ADR) to name the records it cites.

## Discovery inputs consumed

- Brainstorm decision 1, Anthropic Messages as the hub: the whole codec shape follows from it, N-1 pairs and an exhaustive fold with a `never` default.
- Brainstorm decision 2, both Responses directions ship: the Responses encoder lands with its own tests, though today's matrix never triggers it.
- Brainstorm decision 3, refusals split by meaning: `renderRefusal` extends `refusals.ts` and adds a Responses envelope.
- Brainstorm decision 4, thinking drops toward OpenAI: the encode leg records a cost-bearing fate, and the decode leg never fabricates a `signature`.
- Brainstorm decision 5, the standing decisions: dangling-tool repair, the vendor drop list, the engine-internal posture, the streaming spike as task one, and the deferred route.
- Code map, `refusals.ts` entry: `AnthropicRefusal` and `OpenAiRefusal` stay module-private, so this change exports them and grows the file with a Responses envelope and `renderRefusal`.
- Code map, `gateway-app.ts` entry: the serving path already answers both dialect path sets with a 404, so it stays the eventual call site rather than a file this change edits.
- Code map, `provider/key-probe.ts` entry: the per-concern subdirectory and the `never`-guarded switch give the precedent, so the library lands under `dialect/` mirroring `provider/`.
- Code map, `engine-child.testkit.ts` entry: the only fixture convention is the `*.testkit.ts` sibling and no fixtures directory exists, so every fixture lands as a testkit sibling.
- Code map, `knip.json` entry: the engine workspace declares only the mutation config as an entry, so a library with a parked consumer trips `lint:dead` until the barrel joins the entry list.
- Code map, `.dependency-cruiser.cjs` entry: `engine-only-contracts` and `no-circular` bound the imports, so the library reaches only `@recompose/contracts` and stays acyclic.
- Code map, `api-keys.ts` entry: `keyProviderIdSchema` names a two-member provider pair, consulted, no impact, because the dialect set holds three members and stays engine-internal.
- Code map, `docs/adr/README.md` entry: the index ends at 0074 and no record covers the hub, so the hub decision drafts here as ADR-0075.
- Research finding 1, the Codex Chat Completions removal: Codex speaks Responses alone, which is why both Responses directions ship.
- Research finding 2, the routing matrix: local runtimes and aggregators speak Chat Completions, so the egress side stays two dialects and the matrix concentrates on Anthropic and Chat Completions.
- Research finding 4, asymmetric validation: the missing `max_tokens`, the empty text block, the dangling tool call, the system-message placement, and the numeric clamps each become a mapped or a refused fate.
- Research finding 5, the vendor drop list: the ignored-field set lifts from Anthropic's compatibility table into a data module per peripheral dialect.
- Research finding 6, the streaming hazards: the index remap, the usage timing, the tool-id synthesis, the terminator, the mid-stream error, and the unknown event each become a stream test case.
- Research finding 7, the stop reasons: the mapping is lossy both ways, so an unmappable reason refuses typed rather than defaulting.
- Research finding 8, build against adopt: the ADR names `@musistudio/llms` and declines it on the Hono zero-dependency posture ADR-0057 set.
- Rider ledger, #117: the translator creates no composition surface, so the virtual model prohibition stays out of reach early.
- Rider ledger, parked-consumer decisions: the interface stays fetch-free and secret-free, renders refusals in the arriving dialect, and lets the caller skip a same-dialect translation.
- Rider ledger, the ADR-0057 precondition: the streaming spike runs as task one, and the pure stream transforms let it test them unchanged.

## Goals and non-goals

**Goals:**

- A request, a response, and an event stream cross among Anthropic Messages, OpenAI Chat Completions, and OpenAI Responses.
- Every field on the source meets one of three fates the translation names: carried, mapped, or refused typed.
- A field a dialect shape adds without a routing arm fails typecheck rather than dropping in production.
- Both Responses directions ship, decode and encode, each with its own tests.
- Each typed refusal renders in the arriving dialect's error envelope, and the refusals split by meaning.
- The stream codecs stay pure async-iterable transforms, so the ADR-0057 spike tests them unchanged.
- The library stays engine-internal, adds no package export, and adds no runtime dependency.

**Non-goals:**

- No `/v1/responses` ingress route. The route belongs to the parked consumer, not to this library.
- No serving-path wiring. `gateway-app.ts` gains no route, and the both-dialects 404 spec stays green.
- No `README.md` Codex correction. The claim that recompose serves Codex today waits on the consumer that serves the route.
- No fetch and no credential. The translator sees request and response shapes alone, never a secret.
- No new package boundary. The hub model and the event model stay plain types under `packages/engine/src/`.
- No composition surface. The library creates nothing that would drive rider #117 early.

## Constraints and invariants

- TypeScript runs at maximum strictness: `strict: true` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, and `noPropertyAccessFromIndexSignature`.
- No `any`, no `as` casts to silence errors, and no `@ts-ignore` or `@ts-expect-error` without a comment explaining why.
- Never write code comments. Code explains itself through naming and structure. The sole exception is a constraint the code can't express.
- The engine reaches only `@recompose/contracts`, per the `engine-only-contracts` rule, and imports no Electron.
- The module graph stays acyclic, per the `no-circular` rule at error severity.
- The engine adds no new runtime dependency. Wire shapes are plain TypeScript types, and any runtime parse rides the zod that already reaches the engine through `@recompose/contracts`.
- Expected failures travel as typed results with context, never as thrown surprises.
- Test-first, always: red, green, refactor. Test code changes if and only if behavior changes. Doubles appear only at real process boundaries.
- Fixtures land as `*.testkit.ts` siblings, which the coverage and mutation configs already spare.
- Load-bearing derived types get `*.test-d.ts` specs with `expectTypeOf`, run through vitest typecheck.
- The renderer stays untouched, so the Feature-Sliced Design gate and the stories gate have nothing new to judge.
- Authored markdown passes Vale and cspell. Never use an em dash.
- `main` stays protected. One job, one branch, one pull request.

## Design

### The shape

Anthropic Messages is the hub, and every dialect folds through it. Each dialect decodes to the hub and encodes back out of it, so a translation from one dialect to another composes a decoder and an encoder over a shared pivot. Codec growth stays linear at N-1 pairs, and a fourth dialect touches no existing codec. Three pieces sit at the center, and a codec pair sits at each dialect.

1. **The hub model** holds the canonical message model and event model as plain TypeScript types, the Anthropic Messages shape the pivot speaks.
2. **The fates** name the discriminated union every crossing field lands in: carried, mapped, or refused.
3. **The refusals** grow `refusals.ts` with a Responses envelope and the `renderRefusal` projector.
4. **A codec pair per dialect** decodes into the hub and encodes out of it, over request, response, and stream alike.
5. **A drop-list data module per peripheral dialect** lifts the vendor's ignored-field set from Anthropic's compatibility table.
6. **The dispatcher** composes a decoder with an encoder, and lets the caller skip a same-dialect crossing.

```
chat-completions --decode--> [ Anthropic Messages hub ] --encode--> anthropic
      responses  --decode-->            |               --encode--> chat-completions
       anthropic --decode-->            |               --encode--> responses
```

### The exhaustive fold and the never default

Each hub codec is a fold over the source's block and field kinds. The fold routes every kind through a `switch`, and a `never` default throws the way `key-probe.ts` and `engine-child.ts` already guard their directive switches. A kind added to a dialect shape without a routing arm fails typecheck at the `never` assignment, so a silent drop becomes a compile error rather than a production 400. The fold reads as the same idiom the engine ships today, which keeps the mutation gate honest against it.

### The two egress dialects

The egress side speaks two dialects, because no target speaks Responses. Subscriptions speak Anthropic, per ADR-0069, and keys, aggregators, and local runtimes speak Chat Completions, per ADR-0072 and ADR-0073. Responses arrives only as ingress, so the real routing matrix concentrates on the two egress dialects and never widens. The hub choice earns that concentration: the pivot already holds the Anthropic shape the strict egress target demands.

### The three fates

The translation gives every source field one of three fates, and a discriminated union names them. A carried field crosses unchanged. A mapped field takes the target dialect's shape, and its ledger entry names the change. A refused field produces a typed refusal, and the crossing stops. The encoder decides each field's fate as it folds the hub into the target, so a field the target can't take never vanishes without a trace.

Two guards together make a silent drop impossible. The `never` default catches a kind with no routing arm at compile time. A run-time leftover-key diff catches a field the wire carried but the ledger never named, which a vendor addition to a dialect shape would trigger. The fold names one, and the diff names the other.

### The vendor drop list

The set of ignored fields lifts from Anthropic's published compatibility table for the OpenAI client library, verbatim. It lives as one data module beside each peripheral dialect's codec, one authoritative table per dialect. The table names the fields that don't cross between that dialect and the hub, in whichever direction the leg touches the dialect. `logprobs`, `seed`, `service_tier`, and their kin drop with a no-cost fate. The cache and thinking losses drop with a cost-bearing fate the consumer's usage log can surface. An invented drop list would drift from the behavior clients already expect, so the change adopts the vendor's own list rather than authoring one.

### Refusals in the arriving dialect

Refusals split by meaning, and each renders in the dialect the request arrived in. An unknown model refuses 404. An unmappable stop reason, and a dangling tool call the translation can't repair, refuse 400 or 422. An upstream condition carries its own status. `renderRefusal(dialect, refusal)` projects each typed refusal into the arriving dialect's error envelope. It extends `refusals.ts`, whose `AnthropicRefusal` and `OpenAiRefusal` types this change exports, and beside which the change adds a Responses envelope. A dangling tool call repairs by default. The translation drops the unmatched entry and records the repair as that call's named fate, so a loose OpenAI-family history reaches a strict Anthropic target. Only an unrepairable case refuses typed, naming the unmatched id.

### The streams

The stream codecs stay pure async-iterable transforms, or pure step functions over a parsed frame and an accumulator, so the ADR-0057 streaming spike tests them unchanged. The spike is task one, because the `@hono/node-server` adapter's streaming behavior under Node lacks first-party documentation. Six hazards from the research brief each drive a stream test.

- **Index namespaces differ.** Anthropic's index counts every content block, and OpenAI's `tool_calls[].index` counts only tool calls, so the transform remaps rather than copies the index.
- **Usage arrives at the wrong time.** Anthropic's `message_start` owes input tokens before OpenAI supplies them, so the transform emits the opening event and reconciles usage from the final chunk.
- **Tool identity can go missing.** An OpenAI-compatible server may omit the tool-call id, so the transform synthesizes a deterministic `toolu_` id the client can act on.
- **Terminators differ.** OpenAI ends with a `[DONE]` sentinel and Anthropic ends with `message_stop`, so the transform ends the way the target dialect ends.
- **Mid-stream errors have no symmetric form.** The transform maps the source dialect's error shape to the target's in both directions, and no synthetic success stands after a failure.
- **Unknown events pass through.** An unknown upstream event passes or drops without terminating the stream, per the vendor's own versioning rule.

### Thinking and the signature

Neither OpenAI dialect carries a counterpart to Anthropic's thinking blocks. Encoding toward either drops the thinking block and records a cost-bearing fate the consumer's usage log can surface. Decoding toward Anthropic never fabricates a `signature`, because the signature is the integrity check on a thinking block the source never produced.

### Trade-offs in view

The hub buys linear growth and one compile-time silent-drop guarantee at the cost of a two-hop leg. A Responses-to-Chat-Completions translation folds through the strict Anthropic hub, so it inherits the hub's strictness on the way through. A field the hub rejects refuses with a traced fate rather than passing loose. That strictness is the point of the seam this change defends, so the design accepts the two-hop cost and traces every fate it produces.

## Data model and contracts

The library adds no package export and no contracts module. The hub model, the event model, the fate union, and the per-dialect wire shapes all stay plain TypeScript types under `packages/engine/src/dialect/`. Any runtime parse rides the zod that already reaches the engine through `@recompose/contracts`, the way `engine-child.ts` runs `safeParse` on a directive before it acts.

The one contract that widens is `refusals.ts`. It exports the two refusal types it holds private today. It adds a Responses envelope type and its constructor, plus the `renderRefusal` projector and the typed translation-refusal union the fates carry. No shipped shape changes, so no consumer of the existing refusals breaks.

### The hub model

`dialect/hub.ts` holds the canonical types. `HubRequest`, `HubResponse`, and `HubEvent` speak the Anthropic Messages shape: the system prompt, the content blocks, the tool definitions, the tool choice, the stop reason, the usage counts, and the streaming events. The decoders produce these shapes, and the encoders consume them.

### The fates

`dialect/fates.ts` holds the union and the ledger.

```ts
export type Fate =
  | { fate: 'carried'; field: string }
  | { fate: 'mapped'; field: string; note: string }
  | { fate: 'refused'; field: string; refusal: TranslationRefusal };

export type Translated<T> = { body: T; ledger: readonly Fate[] };

export type TranslateResult<T> = Translated<T> | { refusal: TranslationRefusal };
```

A translation with no refused fate answers `Translated`, carrying the body and the ledger of carried and mapped fates. A translation that hits a refused fate answers the refusal, which the caller renders. The leftover-key diff runs in the tests, comparing the source's keys against the fields the ledger names.

### The refusal envelopes

`renderRefusal` answers one of three envelope shapes. `AnthropicRefusal` and `OpenAiRefusal` already exist, and the change adds `ResponsesRefusal` beside them. The projector reads the arriving dialect and the typed refusal, and returns the envelope with its status.

## Error handling

| Failure                                   | Representation                                           | The wire carries                                    |
| ----------------------------------------- | -------------------------------------------------------- | --------------------------------------------------- |
| The routed model is unknown               | `{ fate: 'refused' }`, an unknown-model refusal          | the arriving dialect's 404 envelope                 |
| The source stop reason maps to nothing    | `{ fate: 'refused' }`, an unmappable-stop-reason refusal | the arriving dialect's 400 or 422 envelope          |
| A dangling tool call has no honest repair | `{ fate: 'refused' }`, naming the unmatched id           | the arriving dialect's 400 or 422 envelope          |
| A dangling tool call repairs              | `{ fate: 'mapped' }`, the drop recorded                  | the target shape without the unmatched entry        |
| An upstream answer already failed         | the upstream status, carried                             | the mid-stream error mapped to the arriving dialect |
| The thinking block meets an OpenAI target | `{ fate: 'mapped' }`, cost-bearing                       | the target shape without the thinking block         |
| A vendor-ignored field meets the hub      | `{ fate: 'mapped' }`, the drop recorded                  | the hub or target shape without the field           |
| A dialect shape adds an unhandled kind    | a compile error at the `never` default                   | nothing, because the build fails first              |
| A field escapes the ledger at run time    | a leftover-key diff failure in the tests                 | nothing, because the spec fails first               |

Three rules bind the codecs. No silent failures: the `never` default and the leftover-key diff together catch every unhandled field. Fail with context: a refusal names the field, the dialect, and the reason, and an unrepairable tool call names the unmatched id. Model expected failures as typed results: an unmappable reason is a refused fate, not a thrown surprise.

## File map

### The translation library

- `packages/engine/src/dialect/hub.ts`: the canonical hub message model and event model as plain types (create)
- `packages/engine/src/dialect/hub.testkit.ts`: hub-shape builders the codec specs share (create)
- `packages/engine/src/dialect/fates.ts`: the three-fate union, the ledger, and the translate-result shape (create)
- `packages/engine/src/dialect/fates.test.ts`: the union's discrimination and the leftover-key diff (create)
- `packages/engine/src/dialect/fates.test-d.ts`: the union's arms and the result shape at the type level (create)
- `packages/engine/src/dialect/chat-completions-*.ts`: the Chat Completions codec, split per concern to hold the max-lines gate: `chat-completions-wire.ts` (the wire types), `-request.ts`, `-response.ts`, `-stream.ts` (each with the `never`-guarded fold), `-drops.ts` (the vendor drop table lifted from Anthropic's compatibility table), and `-codec.ts` (a thin barrel re-exporting the public decode and encode functions the dispatcher imports) (create)
- `packages/engine/src/dialect/chat-completions*.test.ts` and `chat-completions.testkit.ts`: the codec behavior including the bare-object-schema normalization and the stream hazards, and the shared builders, split to hold max-lines (create)
- `packages/engine/src/dialect/responses-*.ts`: the Responses codec, split the same way, both directions shipping: `responses-wire.ts`, `-request.ts`, `-response.ts`, `-stream.ts`, `-drops.ts`, and `-codec.ts` (create)
- `packages/engine/src/dialect/responses*.test.ts` and `responses.testkit.ts`: the codec behavior including the loose-history repair and the encode-leg tests, and the builders (create)

A full bidirectional codec exceeds the repo's 300-line file gate. The clean-code single-responsibility rule already asks for the split, so each codec is a set of per-concern modules behind a thin `-codec.ts` barrel. No lint override lands.

- `packages/engine/src/dialect/dispatcher.ts`: the facade composing a decoder with an encoder, with the same-dialect skip (create)
- `packages/engine/src/dialect/dispatcher.test.ts`: the composition, the round-trip property, and the skip (create)
- `packages/engine/src/dialect/index.ts`: the library barrel the knip entry names (create)

### The refusals

- `packages/engine/src/refusals.ts`: exports the two refusal types, adds the Responses envelope, the translation-refusal union, and `renderRefusal` (modify)
- `packages/engine/src/refusals.test.ts`: `renderRefusal` over the three dialects and the split-by-meaning statuses (create)

### The stream spike

- `packages/engine/src/dialect/stream-spike.test.ts`: the ADR-0057 spike over `@hono/node-server`, proving the async-iterable transform shape holds under Node (create)

### Config and records

- `knip.json`: the engine workspace gains `src/dialect/index.ts` as an entry, so `lint:dead` stays green while the consumer stays parked (modify)
- `cspell-words.txt`: the vocabulary this change's diff introduces (modify)
- `docs/adr/0075-dialect-translation-folds-through-an-anthropic-messages-hub.md` and `docs/adr/README.md`: land at implementation from the draft below (create)

The engine Stryker gate mutates every `dialect/` module and the `renderRefusal` addition as ordinary node-side logic at break 80. The `*.testkit.ts` siblings stay outside the mutate glob, so no exclude line lands.

## Interfaces

### The library

- Consumes: the zod that reaches the engine through `@recompose/contracts`, and the platform stream types.
- Produces:
  - `type Dialect = 'anthropic' | 'chat-completions' | 'responses'`
  - `decode` and `encode` per dialect, over request, response, and stream, through the hub types
  - `translateRequest(from: Dialect, to: Dialect, request): TranslateResult<...>`, and the response and stream twins, with the same-dialect skip
  - `Fate`, `Translated<T>`, and `TranslateResult<T>` from `dialect/fates.ts`

### The refusals

- Consumes: the typed translation-refusal union the fates carry.
- Produces:
  - `AnthropicRefusal` and `OpenAiRefusal`, now exported
  - `ResponsesRefusal` and its constructor
  - `renderRefusal(dialect: Dialect, refusal: TranslationRefusal): AnthropicRefusal | OpenAiRefusal | ResponsesRefusal`

## Decisions

### 1. Dialect translation folds through an Anthropic-Messages hub

This is the change's architectural decision, and it lands as ADR-0075. The draft follows.

**Context.** A gateway serves both dialects at one address, per ADR-0005, and a request reaches only a target that speaks its own dialect. An OpenAI-dialect client must reach an Anthropic subscription target, and a Responses-dialect client such as Codex must reach either egress target. Three dialects cross in the general case: Anthropic Messages, OpenAI Chat Completions, and OpenAI Responses. Every proxy that attempts this breaks at one seam, because Anthropic holds a strict schema and the OpenAI dialects tolerate a loose history.

**Decision.** Anthropic Messages is the hub, and every dialect folds through it. Each dialect grows a decoder into the hub and an encoder out of it, so a crossing composes a decoder with an encoder over a shared pivot. Each hub codec is an exhaustive fold over the source's block and field kinds, and a `never` default throws on an unhandled kind. Three fates govern every field: carried, mapped, or refused typed. The encoder decides each field's fate. A run-time leftover-key diff and the compile-time `never` default together make a silent drop impossible. Both Responses directions ship, decode and encode, though no target speaks Responses today.

**Alternatives.** Pairwise conversions, rejected: a direct codec per ordered dialect pair grows N squared and a fourth dialect touches every existing codec. A neutral canonical form, rejected: a separate neutral type buys the same compile-time exhaustiveness the `never` fold gives. That neutral form costs a third shape to maintain that no dialect speaks. Adopting `@musistudio/llms`, rejected: its transformers ship inside a Fastify server. ADR-0057 chose Hono for shipping zero runtime dependencies, so adopting a Fastify host to borrow its transformers inverts that decision.

**Consequences.** **Good**: codec growth stays linear at N-1 pairs. The routing matrix concentrates on the two egress dialects the targets speak, and the exhaustive fold turns a silent drop into a compile error. **Bad**: a Responses-to-Chat-Completions crossing folds through the strict Anthropic hub, so it inherits the hub's strictness on the two-hop leg. A field the hub rejects refuses with a traced fate rather than passing loose. The stream codecs rest on the ADR-0057 streaming spike, which runs without a benchmark, so the transform shape stays a bet until task one confirms it.

**ADR draft:** `docs/adr/0075-dialect-translation-folds-through-an-anthropic-messages-hub.md`, from the text above.

### 2. Both Responses directions ship, not the decode alone

Responses is ingress-only in today's matrix, so the hub-to-Responses encode has no target to trigger it. The change ships the encoder anyway, for symmetry with the spec's promise to translate against each dialect the library holds, and to future-proof a Responses target. The encoder carries its own tests even though the real matrix never exercises it yet.

**Alternatives considered:** shipping the decode alone, rejected. The spec promises each dialect crosses all three ways, and a half-built dialect would refuse the encode leg the parked consumer designs against.

**ADR draft:** carried inside draft 1, which owns the hub posture.

### 3. Refusals split by meaning, each in the arriving dialect's envelope

An unknown model refuses 404. An unmappable stop reason, and a dangling tool call the translation can't repair, refuse 400 or 422. An upstream condition carries its own status. `renderRefusal(dialect, refusal)` projects each typed refusal into the arriving dialect's error envelope, extending `refusals.ts` with a Responses envelope beside the two the file already holds. This settles the refusal-status question the parked gateway-virtual-models change left open.

**Alternatives considered:** one flat 404 for every refusal, rejected. It hides a strict-target validation failure behind the same code as a missing model, so the client can't tell the two apart. A thrown error, rejected because expected failures travel as typed results.

**ADR draft:** carried inside draft 1.

### 4. The thinking field drops toward OpenAI with a traced fate

Chat Completions and Responses carry no counterpart to Anthropic's thinking blocks. Encoding toward either drops the thinking block and records a cost-bearing fate the consumer's usage log can surface. Decoding toward Anthropic never fabricates a `signature`, because the signature is the integrity check on a thinking block the source never produced.

**Alternatives considered:** fabricating a signature toward Anthropic, rejected because a synthetic signature claims an integrity the source never vouched for. Dropping the thinking block with no fate, rejected because it hides a cost move from the usage log, which the no-silent-failures rule forbids.

**ADR draft:** carried inside draft 1.

### 5. The vendor drop list lifts from Anthropic, verbatim

The ignored-field set lifts from Anthropic's published compatibility table for the OpenAI client library, and lives as one data module per peripheral dialect. The table names the fields that don't cross between that dialect and the hub. An invented list would drift from the behavior clients already expect, and the vendor's table is the closest thing to a normative specification for this translation.

**Alternatives considered:** authoring a drop list from the dialect shapes, rejected because it would diverge from the compatibility layer clients target, and every divergence is a surprise. Refusing every unsupported field, rejected because the vendor ignores most of them, so a refusal would break requests the vendor accepts.

**ADR draft:** carried inside draft 1.

## Test matrix

| Layer          | What this layer proves (or why none)                                                                                                                                                                                                                                                                                                          | Check command                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Unit           | The hub codecs fold every source kind, the `never` default throws on an unhandled kind, the bare object schema normalizes, the stop reason maps and refuses, the thinking block drops with a fate, the drop tables match the vendor list, and each stream hazard resolves. `renderRefusal` answers the right envelope and status per dialect. | `pnpm run test`                                     |
| Integration    | The dispatcher composes a decoder with an encoder through the hub, answers a `Translated` body with its ledger or a refusal, and skips a same-dialect crossing. This library owns no served path, so the dispatcher facade is the integration seam.                                                                                           | `pnpm run test`                                     |
| End-to-end     | None. The library is pure functions with no served route, so the parked consumer owns the served end-to-end scenario. The `gateway-app.test.ts` both-dialects 404 spec stays green as the guard that the serving path stayed untouched.                                                                                                       | `pnpm run test`                                     |
| Property       | The round-trip holds: Anthropic to Chat Completions to Anthropic, and Responses to Anthropic to Responses, each preserving text content and tool-call pairing. For any status, a mid-stream error maps to exactly one arriving-dialect error shape. The `fast-check` calls sit inside `it` bodies.                                            | `pnpm run test`                                     |
| Mutation scope | The engine diff-scoped gate at break 80 mutates every `dialect/` module and the `renderRefusal` addition as ordinary logic. The `*.testkit.ts` siblings stay outside the mutate glob. The gate reaches the `never`-default arms, so a survived mutant there names an unhandled kind the fold missed.                                          | `pnpm --filter @recompose/engine run test:mutation` |

### Designated mutant killers

| Invariant                                         | Mutant killer                                       |
| ------------------------------------------------- | --------------------------------------------------- |
| The fold routes every source kind                 | the exhaustive-fold spec in each codec test         |
| The round-trip preserves content and tool pairing | the round-trip property in `dispatcher.test.ts`     |
| No field escapes the ledger                       | the leftover-key diff in `fates.test.ts`            |
| The thinking drop bears a cost fate               | the traced-fate spec in the codec tests             |
| Each refusal renders in its dialect               | the per-dialect envelope spec in `refusals.test.ts` |
| A mid-stream error crosses as a failure           | the error-mapping property in the codec tests       |

## Task decomposition hooks

Tasks run in parallel by default. A dispatch serializes only for a named blocker: one task reads what another produces, two tasks own the same file, or one inspects what another writes. Every dispatch names its files and states that the others run on disjoint files.

- Task 1: the streaming spike (depends on: none, hands off: the confirmed async-iterable transform shape the stream codecs test against). Owns `dialect/stream-spike.test.ts`. Runs first because ADR-0057 booked it, and the stream legs of tasks 5 and 6 read its confirmed shape.
- Task 2: the hub model (depends on: none, hands off: `HubRequest`, `HubResponse`, and `HubEvent`). Owns `dialect/hub.ts` and its testkit. Gates every codec, and runs beside tasks 1, 3, and 4 on disjoint files.
- Task 3: the fates (depends on: none, hands off: `Fate`, `Translated`, and `TranslateResult`). Owns `dialect/fates.ts` and its specs. Gates every codec, and runs beside tasks 1, 2, and 4 on disjoint files.
- Task 4: the refusals (depends on: none, hands off: the exported types, the Responses envelope, and `renderRefusal`). Owns `refusals.ts` and its spec. Runs beside tasks 1, 2, and 3 on disjoint files.
- Task 5: the Chat Completions codec (depends on: tasks 1, 2, 3, and 4, hands off: the decode and encode pair and the drop table). Owns `dialect/chat-completions-*`. Runs beside task 6 on disjoint files.
- Task 6: the Responses codec (depends on: tasks 1, 2, 3, and 4, hands off: both directions and the drop table). Owns `dialect/responses-*`. Runs beside task 5 on disjoint files.
- Task 7: the dispatcher (depends on: tasks 5 and 6, because it composes both codec pairs, hands off: the facade and the round-trip property). Owns `dialect/dispatcher.ts` and its spec.
- Task 8: the barrel and records (depends on: task 7, because the barrel exports the dispatcher, hands off: the merged branch evidence). Owns `dialect/index.ts`, `knip.json`, `cspell-words.txt`, and ADR-0075 with its index row.

## Risks

- [Risk] The streaming spike runs without a benchmark, so the stream codecs' shape is a bet → Mitigation: the spike runs as task one, and the pure async-iterable transforms let the spike test them unchanged, so a shape that fails surfaces before the codecs commit to it. Unmitigated: a spike that finds the adapter unfriendly reshapes the stream legs of tasks 5 and 6.
- [Risk] The Responses server-state edge has no honest hub slot → the `previous_response_id` reference and the encrypted reasoning payload describe a server-held conversation the Anthropic hub never models. Mitigation: the decoder refuses that shape typed toward another dialect, naming the field, rather than inventing a hub slot that would lie. Unmitigated: a Responses client leaning on server-held state meets a refusal until a later change models it.
- [Risk] The hub imposes Anthropic strictness on the Responses-to-Chat-Completions two-hop leg → a loose field that a direct Responses-to-Chat-Completions path would pass meets the strict hub instead. Mitigation: the leg traces every fate, so a hub rejection surfaces as a named refusal rather than a silent loss, which is the seam this change defends. Unmitigated: the two-hop leg refuses a shape a direct path would tolerate.
- [Risk] The mutation gate misses a `never`-default arm → a fold's unhandled-kind guard runs only when a test reaches it. Mitigation: each codec test folds every source kind, so the gate reaches the default arms, and a survived mutant there names a kind the fold missed. Unmitigated: an unexercised arm hides a routing gap the compile-time guard alone can't prove reachable.

## Migration and rollout

**Deploy.** One branch carries the whole change, nothing behind a flag. The library lands dark: no route wires it, and the parked gateway-virtual-models change consumes it when it resumes. `knip.json` gains the barrel entry in the same branch, so `lint:dead` stays green with the consumer parked.

**Rollback.** A revert of the branch removes the library and its knip entry together. No runtime path reaches the library, so a rollback touches no served behavior and no stored document.

**Data migration.** None. The library holds pure functions and no persisted shape.

**Records that move in step.** ADR-0075 lands from the draft in decision 1, with its index row. The new vocabulary joins `cspell-words.txt` in the same diff that uses it. The `README.md` Codex correction stays out, because the consumer that serves the route owns it.

## Open questions

- **The injected `max_tokens` default figure.** The relation stands fixed: an OpenAI-dialect request with no `max_tokens`, routed to an Anthropic target, takes a documented and user-visible default rather than a hidden constant. The number settles in one spec during implementation, and it moves no boundary in this design.

## End-to-end verification

This change ships a pure library with no served route, so the final observable check runs the gates rather than the app.

1. `pnpm run test` passes, with the codec, fate, refusal, dispatcher, and stream-spike specs green.
2. `pnpm --filter @recompose/engine run test:mutation` clears break 80 over the `dialect/` modules and the `renderRefusal` addition.
3. `pnpm run lint:deps` stays green: the library reaches only `@recompose/contracts`, imports no Electron, and adds no cycle.
4. `pnpm run lint:dead` stays green: the barrel entry in `knip.json` covers the parked-consumer library.
5. The app still starts and its gateways still answer both dialect paths with a 404, because `gateway-app.ts` gained no route and `gateway-app.test.ts` stays green.

A fresh-context reviewer diffs the result against these criteria:

- The library lives under `packages/engine/src/dialect/`, exports no new package entry, and adds no runtime dependency.
- Each hub codec folds over its source kinds with a `never` default, and a leftover-key diff guards the ledger.
- Both Responses directions ship, decode and encode, each with its own tests.
- `renderRefusal` answers the arriving dialect's envelope, and `refusals.ts` exports the two types and adds the Responses envelope.
- The stream transforms stay pure async-iterable functions the ADR-0057 spike tests unchanged.
- ADR-0075 lands from the draft in decision 1, and the index carries its row.
