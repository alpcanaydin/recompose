## Implementation tasks

Eight tasks. Task 1 runs first and alone, because the streaming spike that Architecture Decision Record (ADR) 0057 booked confirms the async-iterable transform shape the stream codecs test against. Tasks 2, 3, and 4 then run together on disjoint files, because the hub types, the fates, and the refusals gate every codec. Tasks 5 and 6 wait on 1 through 4 and run together. Task 7 waits on 5 and 6. Task 8 waits on 7.

Every task opens with a named failing test, captures the red run it started from, and drives it to green. Test code changes if and only if behavior changes.

- [x] **Task 1: the streaming spike.** Owns `packages/engine/src/dialect/stream-spike.test.ts`. Depends on nothing, and runs first: the stream legs of tasks 5 and 6 read the shape it confirms.
  - [x] Opens red with a spec that drives a pure async-iterable transform through `@hono/node-server` under Node and asserts the frames arrive in order and the stream ends clean, before the harness exists.
  - [x] The spike proves the async-iterable transform shape holds under the adapter, or names the reshape the stream codecs need. It carries no dialect logic, and it's the shape confirmation ADR 0057 required before any streaming promise.
  - [x] Layers: the spike is its own evidence, captured in the task report.

- [x] **Task 2: the hub model.** Owns `packages/engine/src/dialect/hub.ts` and `hub.testkit.ts`. Depends on nothing, gates every codec, runs beside tasks 1, 3, and 4 on disjoint files.
  - [x] Opens red in a type-level spec pinning the hub request, response, and event models before the module exists.
  - [x] `hub.ts` lands the canonical hub message model and event model as plain types: the block union (text, thinking, image, tool_use, tool_result), the request shape (system, messages, tools, tool choice, sampling), the response shape (content, stop reason, usage), and the event model whose tool block open requires a name and an id. The testkit ships hub-shape builders the codec specs share.
  - [x] Layers: type-level.

- [x] **Task 3: the fates.** Owns `packages/engine/src/dialect/fates.ts`, `fates.test.ts`, and `fates.test-d.ts`. Depends on nothing, gates every codec, runs beside tasks 1, 2, and 4 on disjoint files.
  - [x] Opens red in `fates.test.ts`: a translation carrying a leftover source key the fold never routed records a fate for it, before the leftover-key diff exists.
  - [x] `fates.ts` lands the three-fate discriminated union (carried, mapped, refused), the `Translated<T>` envelope carrying a value and a fate ledger, the `TranslateResult<T>` union over a translation or a typed refusal, and the leftover-key diff that emits a fate for any source key the fold left unrouted. A property pins that every source field lands exactly one fate. `fates.test-d.ts` pins the union arms and the result shape at the type level.
  - [x] Layers: unit, property, and type-level.

- [x] **Task 4: the refusals.** Owns `packages/engine/src/refusals.ts` and `refusals.test.ts`. Depends on nothing, runs beside tasks 1, 2, and 3 on disjoint files.
  - [x] Opens red in `refusals.test.ts`: `renderRefusal('responses', refusal)` answers the Responses error envelope, before the envelope or the projector exists.
  - [x] `refusals.ts` exports the shipped `AnthropicRefusal` and `OpenAiRefusal` types, adds a `ResponsesRefusal` envelope beside them, adds the typed translation-refusal union, and adds `renderRefusal(dialect, refusal)` projecting each refusal into the arriving dialect's envelope with the split-by-meaning status (unknown model 404, unmappable stop reason or unrepairable dangling tool 400 or 422, upstream carries its own). The shipped `gateway-app.test.ts` 404 specs stay green.
  - [x] Layers: unit.

- [x] **Task 5: the Chat Completions codec.** Owns the `packages/engine/src/dialect/chat-completions-*` glob, split per concern (wire, request, response, stream, drops, and a thin codec barrel) to hold the max-lines gate. Depends on tasks 1, 2, 3, and 4. Runs beside task 6 on disjoint files.
  - [x] Opens red in `chat-completions-codec.test.ts`: a tool-calling request decodes to the hub keeping tools, choice, and system, before the codec exists.
  - [x] The codec decodes a Chat Completions request, response, and stream into the hub and encodes them back, as exhaustive folds with a `never` default. It collapses system and developer messages to one leading system string joined by a newline, normalizes a bare object schema to explicit empty properties, injects a documented visible token ceiling toward the hub, clamps temperature, drops empty text blocks, repairs a dangling tool call with a named fate, and drops the thinking block toward Chat Completions with a cost-bearing fate. The stream leg remaps the index namespaces, defers usage timing, synthesizes a stable tool id when the upstream omits one, maps the terminator both ways, maps a mid-stream error both ways, and passes an unknown event through. `chat-completions-drops.ts` holds the vendor drop table lifted verbatim from the compatibility table.
  - [x] Layers: unit, property, and stream.

- [x] **Task 6: the Responses codec.** Owns the `packages/engine/src/dialect/responses-*` glob, split per concern the same way. Depends on tasks 1, 2, 3, and 4. Runs beside task 5 on disjoint files.
  - [x] Opens red in `responses-codec.test.ts`: a Codex request decodes to the hub keeping instructions, tools, and input, before the codec exists.
  - [x] The codec decodes and encodes the Responses dialect both ways over request, response, and stream, as exhaustive folds with a `never` default. Both directions ship, and the encode leg carries its own tests though no target speaks Responses today. The server-state shape (a prior-response reference, an encrypted reasoning payload) refuses typed toward another dialect, naming the field, rather than inventing a hub slot. `responses-drops.ts` holds its vendor drop table.
  - [x] Layers: unit, property, and stream.

- [x] **Task 7: the dispatcher.** Owns `packages/engine/src/dialect/dispatcher.ts` and `dispatcher.test.ts`. Depends on tasks 5 and 6, because it composes both codec pairs.
  - [x] Opens red in `dispatcher.test.ts`: a same-dialect crossing skips translation and reports passthrough, before the facade exists.
  - [x] `dispatcher.ts` composes a decoder with an encoder through the hub, exposes `translateRequest`, `translateResponse`, and `translateStream` over the dialect pair, and skips a same-dialect crossing. The round-trip property lands here: Anthropic to Chat Completions to Anthropic, and Responses to Anthropic to Responses, each preserving text content and tool-call pairing, with the `fast-check` calls inside `it` bodies.
  - [x] Layers: unit and property.

- [ ] **Task 8: the barrel and records.** Owns `packages/engine/src/dialect/index.ts`, `knip.json`, `cspell-words.txt`, and `docs/adr/`. Depends on task 7.
  - [ ] `index.ts` re-exports the dispatcher and the fate and refusal types the parked consumer imports.
  - [ ] `knip.json` gains `src/dialect/index.ts` as an engine entry, so `lint:dead` stays green while the consumer stays parked.
  - [ ] ADR 0075 lands from the design's decision 1 draft, with its `docs/adr/README.md` index row.
  - [ ] `cspell-words.txt` carries the vocabulary the diff introduces.
  - [ ] Layers: the barrel plus the records.

- [ ] **Task 9: port the reference test suite and the reasoning mapping.** Owns the codec test and source files it extends (`chat-completions-codec.*`, `responses-codec.*`, their testkits and drops). Depends on tasks 5, 6, and 7, because it strengthens the codecs they land. Added on 2026-08-05 after the maintainer read the CLIProxyAPI reference tests.
  - [ ] Port the reference request cases as fixtures and drive any missing behavior: tool-call id sanitization consistent across `tool_use` and `tool_result`, parallel tool-result grouping into one user turn, base64 and URL image blocks in tool results, system and developer roles collapsing to ordered system blocks, the system-only fallback user message, cache-control preservation with part-over-message and last-block precedence, and root schema union normalization.
  - [ ] Port the reference response cases: the usage mapping where prompt tokens sum input and cache-read and cache-creation, cache-read maps to cached tokens, and a `message_start` usage merges with a later `message_delta` where output tokens overwrite rather than sum.
  - [ ] Implement the reasoning mapping the amended decision 4 names: a Responses reasoning item crosses to an Anthropic thinking block on a compatible signature, to a redacted thinking block on redacted content, and drops on a foreign-provider signature. The `previous_response_id` handle stays a typed refusal. Remove any encrypted-reasoning refusal task 6 may have left.
  - [ ] Every ported case reads as a Given/When/Then behavior spec, so the suite proves recompose passes the same cases the reference does.
  - [ ] Layers: unit and property, with the ported fixtures.
