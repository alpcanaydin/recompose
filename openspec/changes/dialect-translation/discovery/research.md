# Research brief: dialect translation (tier standard)

## Scope note and one honest gap up front

I could not read `openspec/changes/dialect-translation/proposal.md`. In this context only `Read` was available (no `Glob`, no `Grep`, no `Bash`), so I could not enumerate directories, and my path guesses for `openspec/changes/dialect-translation/proposal.md`, `openspec/project.md`, `openspec/AGENTS.md`, and `openspec/specs/gateway/spec.md` all missed. **Everything below is anchored on the repository artifacts I did open plus vendor docs, not on the proposal's own wording.** If the proposal already fixes a narrower scope, reconcile against section 1 first, because that is where I expect a mismatch.

Repository anchors I did read: `README.md`, `docs/adr/README.md`, `docs/adr/0005-single-port-path-per-gateway.md`, `docs/adr/0057-the-engine-serves-over-hono.md`, `CLAUDE.md`.

## 1. Headline finding: the OpenAI client dialect is no longer Chat Completions

`README.md` line 22 names Codex as a supported client, and line 54 says "OpenAI-dialect clients set `OPENAI_BASE_URL` to the same address." `docs/adr/0005-single-port-path-per-gateway.md` defines the OpenAI dialect as the path `/v1/chat/completions`.

OpenAI removed the Chat Completions wire protocol from Codex. The announcement (openai/codex discussion #7782, posted 9 December 2025) states Codex "is deprecating support for the `chat/completions` API. Full removal is slated for early February 2026," and that during deprecation it emits a warning which "will transition to a hard error as support is fully removed." Affected configurations are exactly "a custom model provider with `wire_api = \"chat\"` or have not specified a `wire_api`." Official guidance to proxy operators: "please coordinate with your IT or platform team to ensure your proxy supports the `responses` API." Search results indicate `wire_api` now accepts only `responses`, and that omitting it defaults to `responses`.

Consequence for this change: a gateway that serves only `/v1/chat/completions` on the OpenAI side **cannot serve Codex at all**, translation quality notwithstanding. Codex will POST `/v1/responses`, hit no route, and fail at session start.

Recommendation: keep this change scoped to Anthropic Messages <-> OpenAI Chat Completions in both directions, because Chat Completions is still the dialect that aggregators and local runtimes actually expose, and record `/v1/responses` ingress as a named deferral with its own change and ADR. Pair that deferral with a `README.md` correction, since claiming Codex today is a factual overstatement. Do not fold Responses into a standard-tier change; it is a third dialect with its own event taxonomy, not a variant of the second.

## 2. The translation matrix, and why it is four pairs rather than two

`README.md` line 45 shows the load-bearing case: one failover ladder holding `[ Claude · sonnet ]` above `[ OpenAI · gpt-5 ]`. Either client dialect can arrive at either target dialect, so the engine owes four conversions: Anthropic ingress to Anthropic egress (passthrough), Anthropic ingress to OpenAI egress, OpenAI ingress to Anthropic egress, OpenAI ingress to OpenAI egress (passthrough). Recent records widen the target side further: `docs/adr/0072-a-local-runtime-account-is-a-credential-free-observation.md` and `docs/adr/0073-the-aggregator-connects-as-a-key-and-offers-no-check.md` add local runtimes and aggregators, which in practice speak Chat Completions. The two passthrough legs are not free either: they still need the validation repairs in section 4, because a permissive client history reaches a strict Anthropic upstream unchanged.

## 3. The ingress surface is more than one route per dialect

Claude Code calls a second Anthropic endpoint. Search surfaced ollama/ollama issue #13949 reporting that Claude Code sends requests to `/v1/messages/count_tokens?beta=true`, receives 404, and that the repeated 404s degraded the server until legitimate requests timed out. The agentgateway integration docs for Claude Code route three things: `/v1/messages`, `/v1/messages/count_tokens`, and a `'*'` fallback. So the minimum Anthropic ingress surface is `POST /v1/messages` with SSE, `POST /v1/messages/count_tokens` (accepting the `?beta=true` query), and a clean 404 for everything else that does not wound the listener. That last clause is a real acceptance criterion, not politeness: `docs/adr/0057-the-engine-serves-over-hono.md` puts every gateway listener in one resident child process, so a route that degrades under 404 pressure degrades every gateway at once.

Note: I did not open ollama/ollama#13949 or the agentgateway page directly; both are search-snippet evidence. Verify the exact query-string and trailing-slash behavior with a live Claude Code capture before writing the criterion.

## 4. Where every existing proxy breaks: asymmetric validation

Anthropic's Messages API validates strictly; Chat Completions tolerates loose history. This asymmetry, not field renaming, is what generates production 400s. Each item below is a candidate acceptance criterion for the OpenAI-ingress-to-Anthropic-egress leg.

**`max_tokens` is required by Anthropic and optional in OpenAI.** envoyproxy/ai-gateway discussion #1136 poses exactly this design question. hermes-agent issue #19360 reports every tool-using request failing with HTTP 400 through an OpenAI-compatible proxy because `max_tokens` was absent when the proxy translated to Anthropic. hermes-agent #12790 reports the second-order failure: when the proxy silently picks its own default (Bedrock 4096), the result is truncation and retry storms. Criterion: the translator injects a documented default and the default is visible to the user, never a hidden constant.

**Anthropic rejects empty text content blocks; OpenAI produces them routinely.** The error is `text content blocks must be non-empty`. This has bitten LiteLLM (#22930 on the native `/v1/messages` path, with PR #17442 fixing the system-message case), the Vercel AI SDK (vercel/ai #5576, empty text blocks generated during tool calling), Claude Code itself (anthropics/claude-code #26870 and #26926), and hermes-agent #11906, whose diagnosis is precise: a tool-call-only response has `content: None`, an empty string gets stored in history, and the next round-trip is rejected. The recommended fix in that thread is normalizing empty assistant content to `None` rather than `""`. Criterion: the translator drops empty text blocks in both directions rather than forwarding them.

**Anthropic requires 1:1 `tool_use` to `tool_result` pairing; OpenAI tolerates dangling tool calls.** LiteLLM issue #19061 states the mismatch directly: OpenAI's Chat API tolerates tool calls that were never answered and whitespace-only messages, while Anthropic requires a perfect 1:1 mapping, producing persistent 400s when clients such as Codex CLI or the OpenAI SDK manage history loosely. The proposed remedy there is sanitization inside the translation path. Criterion: a dangling `tool_calls` entry with no matching `tool` message is either repaired or refused with context naming the unmatched id; it is never forwarded. `.claude/rules/clean-code.md` ("model expected failures as typed results/states") points at the typed-refusal shape here.

**Text after `tool_result` is a 400, and can also yield an empty `end_turn` response.** The Anthropic stop-reason doc is explicit: reply with a user message containing **only** `tool_result` blocks, one per `tool_use` block; adding text after tool results causes errors such as `` `web_search` tool use with id `srvtoolu_...` was found without a corresponding `web_search_tool_result` block ``, and the same mistake produces empty 2-to-3-token `end_turn` responses.

**System message placement.** Anthropic accepts a single initial system parameter; OpenAI allows `system` and `developer` messages anywhere. Anthropic publishes its own algorithm: "the API takes all system/developer messages and concatenates them together with a single newline (`\n`) in between them. This full string is then supplied as a single system message at the start of the messages." Adopt that verbatim rather than inventing one, because it is the behavior a client tuned against Anthropic's own compatibility layer already expects.

**Numeric range clamps.** Anthropic's compatibility table records `temperature` as "Between 0 and 1 (inclusive). Values greater than 1 are capped at 1" against OpenAI's 0-to-2 range, `n` as "Must be exactly 1", and `stop` as "All non-whitespace stop sequences work."

## 5. Lift the drop list from the vendor instead of inventing one

Anthropic publishes a field-by-field compatibility table for its own OpenAI-SDK layer at `/docs/en/api/openai-sdk`. It is the closest thing to a normative specification for this translation and it should be the change's acceptance table. Fields it marks **ignored**: `logprobs`, `metadata`, `response_format`, `prediction`, `presence_penalty`, `frequency_penalty`, `seed`, `service_tier`, `audio`, `logit_bias`, `store`, `user`, `modalities`, `top_logprobs`, `reasoning_effort`, and `tools[n].function.strict`; on messages, `name` everywhere, user `image_url.detail`, `input_audio`, `file`, assistant `refusal` and `audio`. Response fields it marks **always empty**: `usage.completion_tokens_details`, `usage.prompt_tokens_details`, `choices[].message.refusal`, `choices[].message.audio`, `logprobs`, `service_tier`, `system_fingerprint`. The page also states the operative rule: "Most unsupported fields are silently ignored rather than producing errors."

Three of its named limitations matter more than the rest because they change cost or behavior rather than just shape: `strict` is ignored so tool JSON is not schema-guaranteed; audio input is stripped; and "Prompt caching is not supported." That last one means an Anthropic-dialect client sending `cache_control` through a translation to an OpenAI target loses its cache economics silently. Recommendation: silent drop for the vendor-documented ignored set, but the cache and thinking losses get recorded in the usage log so a user can see why a bill moved. That reconciles the vendor behavior with `.claude/rules/clean-code.md`'s no-silent-failures rule without turning every dropped `seed` into an error.

The same page carries a production warning worth quoting in the ADR: the layer "is primarily intended to test and compare model capabilities, and is not considered a long-term or production-ready solution for most use cases." Anthropic is describing its own translation, which is a candid statement of the ceiling on this whole class of feature. The page carries no publication date.

## 6. Streaming: the deferral ADR-0057 already booked

`docs/adr/0057-the-engine-serves-over-hono.md` names the precondition: "The adapter's streaming behavior under Node lacks first-party documentation, so a spike precedes any streaming promise in a later change." Treat that spike as task one of this change, not an assumption.

Anthropic's event taxonomy (from `/docs/en/build-with-claude/streaming`): `message_start`, then per content block `content_block_start`, one or more `content_block_delta`, `content_block_stop`, then one or more `message_delta`, then `message_stop`, with `ping` events interspersed and `error` events possible mid-stream (example: `event: error` / `data: {"type": "error", "error": {"type": "overloaded_error", "message": "Overloaded"}}`). Delta types are `text_delta`, `input_json_delta` (partial JSON strings, where "the final `tool_use.input` is always an _object_"), `thinking_delta`, and `signature_delta`. Two rules stated in the doc: usage in `message_delta` is **cumulative**, and "new event types may be added, and your code should handle unknown event types gracefully."

OpenAI's chunk shape (developers.openai.com streaming-events reference, surfaced via search): `choices[]` of `{ delta, finish_reason, index, logprobs }`, `delta` of `{ content, function_call, refusal, ... }` plus `tool_calls[]` whose entries carry `index`, `id`, and `function.arguments`, accumulated by `index` per the official function-calling guide. Usage appears only with `stream_options: {"include_usage": true}`, in a final chunk whose `choices` may be empty.

Concrete hazards for the translator, each a test case:

- **Two different index namespaces.** Anthropic's `index` counts every content block including text; OpenAI's `tool_calls[].index` counts only tool calls. Mapping one onto the other directly is an off-by-N bug whenever text precedes a tool call, which the vendor's own tool-use example shows is the normal case (text at index 0, `tool_use` at index 1).
- **`input_tokens` is owed at the wrong time.** Anthropic's `message_start` carries `usage` with input tokens; OpenAI supplies usage only in the final chunk. Translating OpenAI to Anthropic requires emitting `message_start` before the number exists.
- **Tool-call identity may be missing upstream.** Anthropic needs an id at `content_block_start` (`toolu_...`); ollama/ollama issue #7881 reports OpenAI-compatible servers omitting `index` on tool-call chunks entirely, which breaks the official streaming helper. Synthesize deterministically and test against a runtime that omits it.
- **Thinking has no Chat Completions counterpart.** The compatibility page states the OpenAI SDK "doesn't return Claude's detailed thought process." Drop `thinking` blocks toward OpenAI. Never fabricate a `signature` toward Anthropic; the doc calls it the integrity check on the thinking block, and it is only strictly required when combining tools with extended thinking.
- **Terminators differ.** OpenAI streams end with a `[DONE]` sentinel; Anthropic ends with `message_stop` and has no sentinel.
- **Mid-stream errors have no symmetric form.** Anthropic has a first-class `error` event; Chat Completions has no standardized equivalent. Decide and document the mapping in both directions.

## 7. Stop reasons do not map cleanly, in either direction

Anthropic returns seven values (`/docs/en/build-with-claude/handling-stop-reasons`): `end_turn`, `max_tokens`, `stop_sequence`, `tool_use`, `pause_turn` (a server-tool loop hit its iteration limit, default 10), `refusal` (**returned as a normal HTTP 200, not an error**), and `model_context_window_exceeded`. OpenAI's `finish_reason` enum is `stop`, `length`, `tool_calls`, `content_filter`, `function_call` (deprecated).

The API7 gateway documents the safe core of the mapping: `stop` to `end_turn`, `length` to `max_tokens`, `tool_calls` to `tool_use`, and `prompt_tokens`/`completion_tokens` to `input_tokens`/`output_tokens`. Beyond that core the mapping is lossy both ways. `pause_turn` and `model_context_window_exceeded` have no OpenAI equivalent; `model_context_window_exceeded` is closest to `length` since the doc says "treat as truncated." `refusal` maps most nearly to `content_filter`, but the semantics differ (Anthropic returns 200 with `stop_details`, and recommends a fallback model), so an honest translator records the loss rather than pretending equivalence. Going the other way, `content_filter` has no Anthropic counterpart except `refusal`. Also note for streaming: `stop_reason` is `null` in `message_start` and delivered in `message_delta`, absent elsewhere.

## 8. Build versus adopt

`CLAUDE.md` requires the off-the-shelf search before a custom implementation, so here is what it found and why I still recommend building.

- **`@musistudio/llms`** (MIT, npm, latest 1.0.53) is the transformer pipeline behind `claude-code-router`, and it is the strongest candidate on paper: real transformers for Anthropic Messages, OpenAI Chat, OpenAI Responses, and Gemini. Against it: search results describe it as providing "the Fastify-based server, routing engine, transformer pipeline, and tokenizer services" as one unit. `docs/adr/0057-the-engine-serves-over-hono.md` rejected Fastify by name for "fifteen runtime dependencies inside the package the boundary rules isolate" and chose Hono partly because it "ships no runtime dependencies." Adopting a Fastify-hosting package to get its transformers inverts that decision.
- **`maxnowack/anthropic-proxy`** and **`nsxdavid/anthropic-max-router`** are standalone proxy servers, single-direction, not importable libraries.
- **LiteLLM** is the most battle-tested translator in existence and the source of most of section 4's evidence, but it is Python and cannot run inside the `packages/engine` utilityProcess.
- **API7/APISIX** documents the conversion well and is worth reading as prior art, but it is a gateway product, and its own docs note the conversion is one-directional by auto-detection and that "Other protocol pairs are not currently supported."

Search did not surface a single-purpose, importable TypeScript translation library. Recommendation: implement pure translation functions inside `packages/engine`, but lift the _contract_ from Anthropic's published compatibility table rather than inventing one, and write the ADR so it names `@musistudio/llms` and the Fastify-coupling reason for declining it. **Caveat: I did not open `@musistudio/llms`'s `package.json` or its exports map, so "transformers are not separable from the server" rests on a search summary, not on inspection. Verify before the ADR cites it as a rejection reason.**

## 9. What this buys the user, stated plainly

`docs/adr/0069-subscriptions-delegate-to-the-providers-tool.md` and the `README.md` provider list mean a Claude subscription target is Anthropic-dialect only. Cross-dialect translation is precisely what lets an OpenAI-dialect client reach that subscription, and what makes the mixed failover ladder in `README.md` line 45 more than a diagram. That is the acceptance story worth writing the e2e scenario against.

## 10. Suggested acceptance criteria, sourced

Each of these traces to a cited failure rather than to taste.

1. An OpenAI-dialect request with no `max_tokens`, routed to an Anthropic target, succeeds; the injected value is documented and user-visible (hermes-agent #19360, #12790, envoyproxy/ai-gateway #1136).
2. An assistant turn carrying a tool call and empty text, replayed to an Anthropic target, succeeds; empty text blocks never reach the wire (LiteLLM #22930, vercel/ai #5576, hermes-agent #11906).
3. A history with a `tool_calls` entry and no matching `tool` message produces a typed refusal naming the unmatched id, never a forwarded 400 (LiteLLM #19061).
4. Multiple `system` and `developer` messages collapse to one leading system string joined by `\n` (Anthropic openai-sdk page).
5. `temperature: 1.7` toward an Anthropic target clamps to 1; `n: 2` is refused (Anthropic openai-sdk page).
6. `POST /v1/messages/count_tokens?beta=true` answers, and a burst of 404s to unknown paths leaves every other gateway on the shared listener healthy (ollama/ollama #13949; `docs/adr/0057-the-engine-serves-over-hono.md`).
7. A streamed tool call preceded by text arrives at the client with correct block indices and a stable tool-call id, including when the upstream omits `index` (Anthropic streaming doc; ollama/ollama #7881).
8. An unknown Anthropic event type in an upstream stream is passed or ignored without terminating the stream (Anthropic streaming doc's versioning rule).
9. `stop_reason: refusal` arriving from an Anthropic target reaches an OpenAI-dialect client as a 200 with a documented `finish_reason`, and the lossy mapping is recorded (handling-stop-reasons doc).
10. Round-trip property: Anthropic to OpenAI to Anthropic preserves text content and tool-call pairing. This is the natural fast-check target the repository's mutation gate will reward.

## 11. Confidence and conflicts

Highest confidence, fetched directly from vendor pages: sections 1 (Codex removal), 5 (the drop list), 6 (Anthropic event taxonomy), 7 (stop reasons), and the API7 core field mapping. Anthropic's doc pages carry no publication date, which is a real weakness in citing them; the API7 page is undated too and pinned to docs version 3.10.x.

Lower confidence, resting on search snippets I did not open: every GitHub issue number in sections 3, 4, and 8, the claim that `wire_api` now accepts only `responses`, and the characterization of `@musistudio/llms` packaging. Open each before it becomes a criterion's citation, because the repository's citation validator (`docs/adr/0041-discovery-workflow-and-citation-validator.md`) exists for exactly this failure mode.

One apparent conflict worth naming rather than resolving: Anthropic's own compatibility layer silently ignores unsupported fields, while `.claude/rules/clean-code.md` forbids silent failures. Section 5 proposes a reconciliation (drop per the vendor list, log the cost-bearing losses), but it is a judgement call the ADR should make explicitly rather than inherit.

Sources:

- [Anthropic: OpenAI SDK compatibility](https://platform.claude.com/docs/en/api/openai-sdk)
- [Anthropic: Streaming messages](https://platform.claude.com/docs/en/build-with-claude/streaming)
- [Anthropic: Handling stop reasons](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons)
- [openai/codex discussion #7782: Deprecating chat/completions support in Codex](https://github.com/openai/codex/discussions/7782)
- [API7 AI Gateway: Convert Anthropic Messages to OpenAI Chat Completions](https://docs.api7.ai/api7-gateway/ai-gateway/use-cases/protocol-conversion)
- [OpenAI: Create chat completion reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)
- [OpenAI: Chat Completions streaming events](https://developers.openai.com/api/reference/resources/chat/subresources/completions/streaming-events)
- [OpenAI: Function calling guide](https://developers.openai.com/api/docs/guides/function-calling)
- [LiteLLM #19061: Anthropic protocol violation, unexpected tool_use_id and empty text content](https://github.com/BerriAI/litellm/issues/19061)
- [LiteLLM #22930: /v1/messages does not sanitize empty text content blocks](https://github.com/BerriAI/litellm/issues/22930)
- [LiteLLM PR #17442: Skip empty text blocks in Anthropic system messages](https://github.com/BerriAI/litellm/pull/17442)
- [LiteLLM #22249: chat/completions request pollutes /v1/messages max_tokens state](https://github.com/BerriAI/litellm/issues/22249)
- [vercel/ai #5576: Empty text content blocks cause errors with Anthropic tool calling](https://github.com/vercel/ai/issues/5576)
- [anthropics/claude-code #26870: Empty text content blocks in messages](https://github.com/anthropics/claude-code/issues/26870)
- [anthropics/claude-code #26926: Empty text content block in messages](https://github.com/anthropics/claude-code/issues/26926)
- [hermes-agent #19360: Missing max_tokens causes HTTP 400 when tools are used with an OpenAI-compatible proxy](https://github.com/NousResearch/hermes-agent/issues/19360)
- [hermes-agent #12790: Anthropic max_tokens fallback skipped for other chat-completions proxies](https://github.com/NousResearch/hermes-agent/issues/12790)
- [hermes-agent #11906: Assistant messages with empty content cause HTTP 400 on Anthropic-compatible proxies](https://github.com/NousResearch/hermes-agent/issues/11906)
- [envoyproxy/ai-gateway #1136: Should we have a default max tokens for Anthropic](https://github.com/envoyproxy/ai-gateway/discussions/1136)
- [ollama/ollama #13949: API compatibility with Claude Code, /v1/messages/count_tokens 404s](https://github.com/ollama/ollama/issues/13949)
- [ollama/ollama #7881: OpenAI-compatible API tool calls have no index](https://github.com/ollama/ollama/issues/7881)
- [@musistudio/llms on npm](https://www.npmjs.com/package/@musistudio/llms)
- [musistudio/claude-code-router](https://github.com/musistudio/claude-code-router)
- [maxnowack/anthropic-proxy](https://github.com/maxnowack/anthropic-proxy)
- [nsxdavid/anthropic-max-router](https://github.com/nsxdavid/anthropic-max-router)
- [agentgateway: Claude Code integration](https://agentgateway.dev/docs/standalone/main/integrations/llm-clients/claude-code/)
