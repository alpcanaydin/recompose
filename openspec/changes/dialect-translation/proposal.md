# Dialect translation, and the hub every dialect folds through

## Why

A gateway serves both dialects at one address, but a request reaches only a target that speaks its own dialect. The failover ladder that holds a Claude subscription above an OpenAI key stays a diagram until an OpenAI-dialect client reaches the Anthropic target. Translation is what turns that mixed ladder into a running path.

The maintainer wants Codex served now. Codex speaks the Responses dialect alone since its Chat Completions removal, so serving it needs a translator fluent in three dialects, not two.

Every proxy that attempts this breaks at one seam. Anthropic holds a strict schema, and the OpenAI dialects tolerate a loose history, so a field dropped in translation becomes a silent production 400. This change owes a discipline before it owes a mapping. Every field meets a named fate, and nothing vanishes without a trace.

The parked gateway-virtual-models change consumes this library when it resumes. This change ships the translation alone, and the serving path stays untouched.

## What changes

**Anthropic Messages is the hub, and every dialect folds through it.** Each dialect decodes to the hub and encodes back from it, so codec growth stays linear and a fourth dialect touches no existing codec. Each hub codec is an exhaustive fold over the source's block and field kinds. A `never` default guards the fold, so a field added to a dialect shape without a routing arm fails typecheck. A silent drop becomes a compile error rather than a production 400.

**The egress side speaks two dialects, because no target speaks Responses.** Subscriptions speak Anthropic, and keys, aggregators, and local runtimes speak Chat Completions. Responses arrives only as ingress, so the routing matrix concentrates on the two egress dialects and never widens.

**Both Responses directions ship, decode and encode, though no Responses target exists yet.** The encode leg has no target to trigger it in today's matrix. It ships anyway, for symmetry with the spec's promise to translate against each dialect the library holds, and to future-proof a Responses target. The encoder carries its own tests.

**Three fates govern every field: carried, mapped, or refused.** The translation carries a field unchanged, maps it to the target dialect's shape, or refuses it as a typed result. A field the translation can't carry never vanishes without a trace. This discipline is the through-line of the whole library, across request, response, and stream alike.

**Refusals split by meaning, and each renders in the arriving dialect's envelope.** An unknown model refuses 404. An unmappable stop reason, and a dangling tool call the translation can't repair, refuse 400 or 422. An upstream condition carries its own status. A `renderRefusal` projector renders each refusal in the arriving dialect's error envelope. It extends `packages/engine/src/refusals.ts`, whose `AnthropicRefusal` and `OpenAiRefusal` types this change exports, and beside which it adds a Responses envelope.

**The thinking field drops toward OpenAI with a traced, cost-bearing fate.** Neither OpenAI dialect carries a counterpart to Anthropic's thinking blocks. Encoding toward either drops the thinking block and records a cost-bearing fate the consumer's usage log can surface. Decoding toward Anthropic never fabricates a `signature`, because the signature is the integrity check on a thinking block the source never produced.

**A dangling tool call repairs, so a loose history reaches a strict target.** An OpenAI-family history can carry a tool call that no result ever answered. The translation drops the unmatched entry and records the repair as that call's named fate, so the loose history reaches a strict Anthropic target. Only an unrepairable case refuses typed, naming the unmatched id.

**The vendor drop list comes from Anthropic, verbatim.** The set of ignored fields lifts from Anthropic's published OpenAI SDK compatibility table. It lives as one data module beside each peripheral dialect's codec, one authoritative table per dialect. An invented drop list would drift from the behavior clients already expect.

**The library stays engine-internal, and adds no runtime dependency.** It lives under `packages/engine/src/`, exports no new package entry, and pulls in no new runtime dependency. Wire shapes are plain TypeScript types, and any runtime parse rides the zod that already reaches the engine through `@recompose/contracts`. `knip.json` gains the library's entry, so `lint:dead` stays green while the consumer stays parked.

**The streaming codecs are pure async-iterable transforms.** Architecture Decision Record (ADR) 0057 booked a streaming spike before any streaming promise, because the `@hono/node-server` adapter's behavior under Node lacks first-party documentation. That spike is task one. The stream codecs stay pure async-iterable transforms, so the spike tests them unchanged.

**What this change leaves out, on purpose.**

- No `/v1/responses` ingress route: the route belongs to the parked consumer, not to this library.
- No `README.md` Codex correction: the claim that recompose serves Codex today waits on the consumer that serves the route.
- No serving-path wiring: the translator is a library of pure functions, and `gateway-app.ts` stays untouched.

## Capabilities

### New capabilities

- `dialect-translation`: a request, a response, and an event stream cross among the three dialects. Every field meets one of three fates, and each typed refusal renders in the arriving dialect's envelope.

### Modified capabilities

None. This change adds an engine-internal library, and no shipped behavior changes. `packages/engine/src/refusals.ts` does export its `AnthropicRefusal` and `OpenAiRefusal` types, which widens their reach without changing a shipped shape.

## Impact

- `packages/engine/src/` gains the translation library: the hub codecs, the peripheral dialect codecs, the vendor drop-list data modules, and the async-iterable stream transforms.
- `packages/engine/src/refusals.ts` exports its two refusal types, gains a Responses envelope, and gains the `renderRefusal` projector.
- `knip.json` gains the library's entry, so `lint:dead` stays green while the consumer stays parked.
- The serving path stays untouched. `gateway-app.ts` adds no route, and the spec that pins its both-dialects 404 answers stays green.
- The streaming spike ADR-0057 booked runs as task one, and the pure async-iterable stream codecs let it test them unchanged.
