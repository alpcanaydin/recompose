# 0075: Dialect translation folds through an Anthropic-Messages hub

**Status**: Accepted
**Date**: 2026-08-05

## Context

A gateway serves both dialects at one address, per Architecture Decision Record (ADR) 0005, and a request reaches only a target that speaks its own dialect. An OpenAI-dialect client must reach an Anthropic subscription target, and a Responses-dialect client such as Codex must reach either egress target. Three dialects cross in the general case: Anthropic Messages, OpenAI Chat Completions, and OpenAI Responses. Every proxy that attempts this breaks at one seam, because Anthropic holds a strict schema and the OpenAI dialects tolerate a loose history.

## Decision

Anthropic Messages is the hub, and every dialect folds through it. Each dialect grows a decoder into the hub and an encoder out of it, so a crossing composes a decoder with an encoder over a shared pivot. Each hub codec is an exhaustive fold over the source's block and field kinds, and a `never` default throws on an unhandled kind. Three fates govern every field: carried, mapped, or refused typed. The encoder decides each field's fate. A runtime leftover-key diff and the compile-time `never` default together make a silent drop impossible.

The dispatcher routes each dialect through a mapped-type record keyed by the dialect union, not a `switch`. The compiler checks the record for completeness, so a new dialect fails typecheck against the record rather than slipping past a cast. This extends the exhaustiveness guarantee to the dialect routing without the `as` cast a `switch` default would demand.

Both Responses directions ship, decode and encode, though no target speaks Responses today. The spec promises each dialect crosses all three ways, and the parked consumer designs against the encode leg.

## Consequences

**Good**: codec growth stays linear at N-1 pairs, and a fourth dialect touches no existing codec. The routing matrix concentrates on the two egress dialects the targets speak, Anthropic for subscriptions and Chat Completions for keys, aggregators, and local runtimes. The exhaustive fold turns a silent drop into a compile error, and the mapped-type record carries that guarantee into the dialect routing without a cast.

**Bad**: a Responses-to-Chat-Completions crossing folds through the strict Anthropic hub, so it inherits the hub's strictness on the two-hop leg. A field the hub rejects refuses with a traced fate rather than passing loose. The stream codecs rest on the ADR-0057 streaming spike, which runs without a benchmark, so the transform shape stayed a bet until task one confirmed it.

## Alternatives

**Pairwise conversions.** Rejected: a direct codec per ordered dialect pair grows N squared, and a fourth dialect touches every existing codec.

**A neutral canonical form.** Rejected: a separate neutral type buys the same compile-time exhaustiveness the `never` fold already gives, and it costs a third shape to maintain that no dialect speaks.

**Adopting `@musistudio/llms`.** Rejected: its transformers ship inside a Fastify server. ADR-0057 chose Hono to ship zero runtime dependencies, so hosting Fastify to borrow its transformers inverts that decision.
