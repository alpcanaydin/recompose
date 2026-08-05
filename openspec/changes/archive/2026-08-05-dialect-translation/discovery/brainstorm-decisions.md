# Brainstorm decisions

Locked with the maintainer on 2026-08-04, after the three-seat candidate panel.

## 1. Anthropic Messages is the hub, with the canonical form's exhaustiveness discipline

Every dialect decodes to and encodes from Anthropic Messages as the pivot, so codec growth stays linear (N-1 pairs) and a fourth dialect touches no existing codec. The hub codecs are written as exhaustive folds over the source's block and field kinds with a `never` default that throws, so a field added to a dialect shape without a routing arm fails typecheck. That gives the hub the same compile-time silent-drop guarantee the neutral-canonical candidate offered, without a separate neutral type to maintain. The routing-matrix finding that decided this: the egress side is only two dialects, because no target speaks Responses (subscriptions are Anthropic, and keys, aggregators, and local runtimes speak Chat Completions), so the real matrix already concentrates on Anthropic.

## 2. Both Responses directions ship, not just the decode

Responses is ingress-only in today's matrix, so hub-to-Responses encode has no target to trigger it. The maintainer chose to build it anyway, for symmetry with the spec's "against each dialect the library holds" and to future-proof a Responses target. The encoder ships with its own tests even though the real matrix never exercises it yet.

## 3. Refusals split by meaning, each in the arriving dialect's envelope

An unknown model refuses 404. An unmappable stop reason, and a dangling tool call that can't be repaired, refuse 400 or 422. Upstream-sourced conditions carry their own status. Each refusal renders in the arriving dialect's error envelope through a `renderRefusal(dialect, refusal)` projector that extends `packages/engine/src/refusals.ts`, whose `AnthropicRefusal` and `OpenAiRefusal` types this change exports and beside which it adds a Responses envelope. This settles the question the parked gateway-virtual-models change left open.

## 4. Thinking crosses honestly in both directions, and no signature is ever fabricated

Chat Completions has no counterpart to Anthropic's thinking blocks, so encoding toward it drops the thinking block and records a cost-bearing fate the consumer's usage log can surface. The Responses dialect does carry reasoning: a reasoning item holds an encrypted content signature and a summary. A reasoning item MUST map to an Anthropic thinking block when its signature is compatible, to a `redacted_thinking` block when the content is redacted, and drop when the signature belongs to another provider and can't cross. This is the reference implementation's behavior, and it's the point of serving Codex against a Claude target: the reasoning chain survives. A decode toward Anthropic never fabricates a `signature`, because the signature is the integrity check on a thinking block the source never produced. The one server-state field that still refuses typed is `previous_response_id`, the conversation handle the stateless hub can't model.

The maintainer amended this decision on 2026-08-05, after reading the reference test suite, replacing the earlier "refuse the encrypted reasoning shape" stance. The reasoning-mapping behavior and the ported reference cases land in the acceptance task named in tasks.md.

## 5. Standing decisions carried from the panel and the briefs

- A dangling tool call is repaired by dropping the unmatched entry and recording the repair as that call's named fate, not refused, so loose OpenAI-family histories reach a strict Anthropic target. Only a repair that can't be made honestly refuses typed, naming the unmatched id.
- The vendor drop list is lifted verbatim from Anthropic's published OpenAI-SDK compatibility table and lives as a data module beside each peripheral dialect's codec, one authoritative table per dialect.
- The library is engine-internal under `packages/engine/src/`, no new package export and no new runtime dependency: wire shapes are plain TypeScript types, and any runtime parse rides the zod already reaching the engine transitively through `@recompose/contracts`. `knip.json` gains the library's entry so `lint:dead` stays green while the consumer is parked.
- The streaming codecs are pure async-iterable transforms so the `@hono/node-server` streaming spike ADR-0057 booked tests them unchanged; that spike is task one.
- `/v1/responses` ingress routing and the README Codex correction are the parked consumer's job, not this library's; this change ships the translation, not the route.
