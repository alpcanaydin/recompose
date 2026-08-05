# 0076: Dialect translation reaches a valid target or refuses typed

**Status**: Accepted
**Date**: 2026-08-05

## Context

Architecture Decision Record (ADR) 0075 folds every dialect through an Anthropic-Messages hub. An adversarial review of the first implementation found the decoder built hub shapes the strict Anthropic target rejects, and the stream decoder threw on input a real provider sends. A message-less request grew a fabricated placeholder turn. Two OpenAI tool-call ids that differ only in characters the sanitizer rewrites collapsed to one id, so a tool call and its answer mispaired without a word. Adjacent same-role turns crossed unmerged, which Anthropic refuses. An unknown streamed output item, such as a built-in web-search call, reached an exhaustive fold and threw after earlier frames had flushed. That throw tore the socket the ADR-0057 yielded error frame protects. A dropped tool-result image and an over-counted cache-read token left the fates ledger dishonest.

The hub also lacked a `redacted_thinking` block, so a Responses reasoning item with redacted content had no honest hub form even though Anthropic Messages models one.

## Decision

The decoder reaches a valid Anthropic target or refuses typed. It never fabricates a turn. A conversation that folds to no message refuses with `empty-conversation`, and a sanitized tool id that two distinct source ids share refuses with `tool-id-collision`. Both render 400 in the arriving dialect's envelope through the `renderRefusal` projector.

The decoder merges adjacent same-role turns so no two same-role turns cross adjacent, the alternation the target demands. Tool-result grouping falls out of this one rule rather than a special case.

The stream decoder tolerates untrusted provider input. An unknown output item skips, and its later delta and done frames skip by index, so the stream ends clean rather than throwing after a flush.

The hub carries a `redacted_thinking` block so the Anthropic-shaped pivot models what Anthropic Messages already models. A Responses reasoning item crosses to it on redacted content.

The hub's `inputTokens` excludes cache reads, matching Anthropic's disjoint token convention and the Chat Completions leg, and clamps at zero. A tool-result image dropped toward a text-only target records a cost-bearing fate.

Because the round trip normalizes on decode, the round-trip property asserts the codec settles to a fixed point rather than an identity.

## Consequences

**Good**: the hub a decoder hands an encoder is a valid Anthropic request or a typed refusal, never a shape the target rejects. A realistic provider stream no longer crashes the crossing. Every loss the codec takes carries a fate, so a usage log reads the true cost. The single same-role merge rule replaces the narrower tool-result grouping.

**Bad**: a request that carried only a system prompt, or only a reasoning item that drops, now refuses where a lenient proxy would invent a turn. A caller that relied on the invented turn sees a 400 instead. The stream skip drops an unknown item's content apart from the absence of its frames, because the hub models no block for it.

## Alternatives

**Fabricate a placeholder turn.** Rejected: an empty user turn is invalid at the Anthropic target in every shape, so the fabrication trades an honest refusal for a hidden failure downstream.

**Disambiguate a colliding tool id with a suffix.** Rejected: a request-scoped rename threads state through the decode for an input a real provider never sends, where a typed refusal states the ambiguity plainly.

**Validate provider bytes at the boundary and keep the throw.** Deferred: the parked serving path owns the untrusted-input boundary. Until it lands the pure library tolerates the unknown item itself rather than trusting a validator that doesn't yet exist.
