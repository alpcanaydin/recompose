## Discovery brief: gateway virtual models

### Scope note and one gap up front

`openspec/changes/gateway-virtual-models/` does not exist in this worktree. I probed `openspec/changes/gateway-virtual-models/proposal.md`, `.../tasks.md`, and `openspec/project.md` and all three are missing, while `openspec/specs/` exists as a directory. So this brief is scoped from the shipped description in `README.md` (virtual models, routers, failover ladders, round-robin pools, dual dialect on one base URL) plus the decision index in `docs/adr/README.md`. If the proposal narrowed the scope, re-aim me at it.

---

### 1. The feature has an industry name, and the closest prior art is explicit about it

"Virtual model" is what Envoy AI Gateway calls [model name virtualization](https://aigateway.envoyproxy.io/docs/capabilities/traffic/model-name-virtualization/): one client-facing name maps to different upstream model names on different providers, using `modelNameOverride` per route rule. Bifrost calls the same thing [model aliasing](https://docs.getbifrost.ai/providers/aliasing-models), and states the design goal recompose is after, decoupling the model name the application sends from the identifier the provider is called with, so `best-model` can be repointed without touching client config.

The oldest and most widely deployed precedent is Azure OpenAI. The `model` field carries a **deployment name**, not a model name, and Microsoft describes deployments as "aliases for model access" ([Foundry endpoints](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/endpoints), [switching endpoints](https://learn.microsoft.com/en-us/azure/foundry-classic/openai/how-to/switching-endpoints)). Claude Code already treats that as a first-class case: for Microsoft Foundry it accepts "a deployment name" in the `model` setting ([model config](https://code.claude.com/docs/en/model-config)).

Routing-graph prior art, ordered by closeness to the recompose canvas:

| System                                                                                            | Alias mechanism                                                                                                                  | Composition                                                                                                                                                                                                                 | Notes for us                                                                                                                             |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [LiteLLM proxy](https://docs.litellm.ai/docs/proxy/configs)                                       | `model_name` is the public alias, `litellm_params.model` is the real target; several deployments share one alias to form a group | `order` for ladders, `weight` for pools, `fallbacks` across groups ([reliability](https://docs.litellm.ai/docs/proxy/reliability), [load balancing](https://docs.litellm.ai/docs/proxy/load_balancing))                     | `model_group_alias` carries a `hidden` flag that keeps an alias out of `/v1/models`. Direct precedent for a per-model "advertise" toggle |
| [Portkey gateway](https://portkey.ai/docs/api-reference/inference-api/config-object)              | Config object with `strategy.mode` of `fallback` or `loadbalance`, `targets[]` with `weight`                                     | Strategies **nest**: a `loadbalance` target can itself be a `fallback` group ([cookbook](https://github.com/Portkey-AI/portkey-cookbook/blob/main/ai-gateway/resilient-loadbalancing-with-failure-mitigating-fallbacks.md)) | Validates "chain routers to combine strategies" as a shipped shape, not an invention                                                     |
| [OpenRouter](https://openrouter.ai/docs/guides/routing/model-fallbacks)                           | `models[]` array in priority order                                                                                               | Walks the list once, never a retry chain; not every failure is fallback-eligible (a malformed-request 400 comes straight back)                                                                                              | The cleanest statement of ladder semantics                                                                                               |
| [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/configuration/fallbacks/)    | Universal endpoint array of provider objects                                                                                     | Returns `cf-aig-step: 0/1/2` naming which rung served                                                                                                                                                                       | Response-attribution precedent                                                                                                           |
| [claude-code-router](https://musistudio.github.io/claude-code-router/docs/server/config/routing/) | `Router` keys (`default`, `background`, `think`, `longContext`) resolve `provider,model`                                         | Per-scenario fallback lists                                                                                                                                                                                                 | Prior art for _request-shape_ routing, which the canvas may want later. Out of scope under YAGNI                                         |

---

### 2. Hard acceptance criteria harvested from the client contract

The [Claude Code gateway protocol reference](https://code.claude.com/docs/en/llm-gateway-protocol) is the single highest-value source for this feature. It is written for gateway operators and it names gateway aliases explicitly. Fetched 2026-08-04; the page cites Claude Code v2.1.197, so treat it as current.

1. **Model discovery has a prefix filter that rejects the names in our README.** Claude Code can query `GET /v1/models?limit=1000` and add results to the `/model` picker, and it "ignores entries whose `id` doesn't begin with `claude` or `anthropic`". Aliases like `fast` and `smart` will never appear in the picker. Discovery is opt-in via `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1`, needs v2.1.129+, has a **3-second timeout**, treats **any redirect as failure** including http to https, sends exactly one credential header (`ANTHROPIC_AUTH_TOKEN` as bearer, otherwise the key as `x-api-key`), reads `id` and optional `display_name`, and caches to `~/.claude/cache/gateway-models.json`. The page's own remedy for filtered aliases is manual client config through the model variables.
2. **An unrecognized model name makes Claude Code send adaptive thinking.** Verbatim: Claude Code "treats model names it doesn't recognize, such as gateway aliases, as current models that receive the field", meaning `thinking: {"type": "adaptive"}`. The symptom is a `400` naming the `thinking` field when the resolved target does not accept it. Anthropic's own error docs confirm the reverse constraint, that models supporting only extended thinking reject `type: adaptive` ([errors](https://platform.claude.com/docs/en/api/errors)). So the act of introducing a virtual model name changes the request body Claude Code sends. This belongs in the spec as a scenario, not a footnote.
3. **Error bodies must pass through byte-for-byte.** "The retry logic matches on the upstream's error wording, so forward error response bodies unmodified. A gateway that wraps upstream errors in its own envelope breaks the recovery path even when it preserves the status code." This is in tension with the house rule in `.claude/rules/clean-code.md` about failing with context. The resolution is to carry recompose context in response headers and the usage log, never in the body.
4. **No buffering.** "Inference responses must stream... a gateway that buffers complete responses before relaying them stalls the client." That closes the door on buffer-then-decide failover.
5. **The system prompt attribution block must stay first and unmodified in the `system` array**, or it reaches the model and the prompt cache key. A virtual-model resolution step that reshapes `system` breaks it.
6. `anthropic-beta` and `anthropic-version` forward unchanged, as **open lists**, not allowlists. `/v1/messages/count_tokens` is optional. Expect a `HEAD /` probe at startup. Claude Code sends `x-claude-code-session-id`, `x-claude-code-agent-id`, and `x-claude-code-parent-agent-id`, which the gateway may consume.

On the OpenAI dialect, `README.md` advertises `/v1/chat/completions`, and Codex is named as a target client. OpenAI now states you can point Codex at any provider supporting Chat Completions or Responses, but that "support for the Chat Completions API is deprecated and will be removed in future releases of Codex" ([Codex models](https://learn.chatgpt.com/docs/models)). Virtual models will need to resolve on `/v1/responses` before that removal lands. Flagging as a risk, not asking for it now.

---

### 3. What the response should say about which model answered

Anthropic shipped server-side fallback and it answers this question authoritatively ([refusals and fallback](https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback), beta `server-side-fallback-2026-07-01`). Three properties worth copying:

- The response `model` field **names the model that answered**, not the model that was requested. Every SDK example prints `response.model` to observe the fallback.
- Attempts are auditable in-band: `usage.iterations` carries a `fallback_message` entry when a fallback model ran, and the docs pair it with `stop_reason` to confirm the fallback served the response.
- In streams, "a `fallback` content block arrives at each model boundary as a `content_block_start` and `content_block_stop` pair with no deltas in between" ([streaming](https://platform.claude.com/docs/en/docs/build-with-claude/streaming)).

Everyone else attributes through a header: `cf-aig-step` ([Cloudflare](https://developers.cloudflare.com/ai-gateway/configuration/fallbacks/)), `x-litellm-model-id` and `x-litellm-model-api-base` plus attempted-fallback headers ([LiteLLM response headers](https://docs.litellm.ai/docs/proxy/response_headers)), and a served-by header in Portkey.

**Recommendation.** Echo the resolved upstream model in `model` and in `message_start`, and add `x-recompose-*` headers naming the virtual model, the router path taken, the target that answered, and the attempt count. The trade-off is real and worth an ADR line: echoing the upstream model leaks the abstraction the alias exists to hide, and any client keying telemetry or caches off `model` sees it change under failover. Anthropic, Cloudflare, and LiteLLM all chose truthful attribution over a stable lie, and the streaming case forces the choice anyway, because `message_start` is already on the wire before a mid-stream boundary.

---

### 4. Failover and pool semantics, with the numbers

**Trigger classification.** Model expected failures as typed states, per `.claude/rules/clean-code.md`. The status taxonomy is settled across the field. Anthropic's table gives `429 rate_limit_error`, `500 api_error`, `504 timeout_error`, `529 overloaded_error` as retryable, against `400/401/402/403/404/409/413` as terminal ([errors](https://platform.claude.com/docs/en/api/errors)). Portkey's conventional default is `on_status_codes: [429, 500, 502, 503, 504]`. OpenRouter fires on context-length, moderation, rate limit, and downtime, and never on a malformed-request 400. `429` and `529` are distinct: only `429` carries `retry-after`, and Anthropic's SDKs "retry transient failures... twice by default, honoring the `retry-after` header when present". Rate-limit headroom arrives on `anthropic-ratelimit-{requests,input-tokens,output-tokens}-{limit,remaining,reset}`, which makes a proactive cooldown possible rather than a reactive one.

**Passive health, cooldown, and ejection.** Envoy's outlier detection is the reference model ([arch overview](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/outlier)): `consecutive_5xx` defaults to 5, `consecutive_gateway_failure` tracks resets and connection failures separately, `base_ejection_time` multiplies by prior ejection count (30s, 60s, 90s), and `max_ejection_percent` stops the pool from emptying. That last knob is the one home-grown routers forget, and a failover ladder needs its equivalent so a provider-wide outage does not eject every rung and leave nothing to answer with.

**Weighted pools.** Use nginx smooth weighted round-robin rather than naive modulo. The [canonical commit](https://github.com/nginx/nginx/commit/52327e0627f49dbda1e8db695e63a4b0af4448b1) (Maxim Dounin, 2012) adds `current_weight` per peer, selects the max, and subtracts the total, turning weights `{5,1,1}` into `a a b a c a a` instead of `c b a a a a a`. It also introduces `effective_weight`, temporarily reduced on failure, which is exactly the "degrade a flaky account without ejecting it" behavior a subscription pool wants. Reference implementations exist if the C is unpleasant to read ([smallnest/weighted](https://github.com/smallnest/weighted)).

**The streaming invariant.** Once a byte is relayed, failover is over. Anthropic sends errors in-band after a `200`: `event: error` with `overloaded_error` ([streaming, error events](https://platform.claude.com/docs/en/docs/build-with-claude/streaming)), and a refusal can arrive mid-stream, where the guidance is to "treat any partial output as incomplete and discard it". SDKs have shipped bugs on exactly this seam ([anthropic-sdk-python #1258](https://github.com/anthropics/anthropic-sdk-python/issues/1258) reports mid-stream SSE errors surfacing as `status_code=200`). Since Claude Code forbids buffering, the spec should state the window explicitly: the ladder may re-attempt until the first forwarded SSE byte, after which an in-band `error` event is relayed verbatim and the attempt is recorded as failed. New event types must be tolerated, per Anthropic's versioning note that "your code should handle unknown event types gracefully".

**The cost of spreading traffic.** A round-robin pool across several accounts destroys prompt-cache reuse, which for Claude Code traffic is the dominant cost and latency term. Under uniform distribution across N targets, identical-prefix requests hit cache roughly 1/N of the time; LiteLLM has this filed as [issue #6784](https://github.com/BerriAI/litellm/issues/6784), noting that with 3 deployments it takes 3+ calls before caching engages. Measured effects of affinity in adjacent systems run from 25% to 75%+ hit rate ([TrueFoundry](https://www.truefoundry.com/blog/kv-cache-routing-why-standard-load-balancers-break-prefix-caching-and-how-to-fix-it)) and 87.4% with 99.92% pod concentration ([Red Hat, llm-d, 2025-10-07](https://developers.redhat.com/articles/2025/10/07/master-kv-cache-aware-routing-llm-d-efficient-ai-inference)). Those numbers are from self-hosted KV-cache serving, not from Anthropic's hosted prompt cache, so treat the magnitude as indicative and the direction as sound. Claude Code hands us the ideal affinity key for free in `x-claude-code-session-id`.

---

### 5. Naming the virtual model

Four constraints collide.

- The repository already owns a slug grammar: lowercase single-dash, at most 63 characters (the DNS label bound), Windows device names refused, living in `packages/contracts` so the creation sheet and main process share it by construction (`docs/adr/0059-the-slug-rule-tightens-to-a-device-safe-identifier.md`). Reuse beats inventing a second identifier rule. Note that the DNS-label motivation does not apply here: a virtual model name is echoed to clients, and since `docs/adr/0056-each-gateway-owns-its-own-loopback-port.md` superseded path routing (`docs/adr/0005-single-port-path-per-gateway.md` is marked Superseded), it never becomes a URL segment.
- Claude Code's discovery filter wants `claude`- or `anthropic`-prefixed ids (section 2.1).
- Anthropic's own guidance frames an alias as a development convenience and recommends pinning a dated snapshot in production, and warns that a dateless id from the 4.6 generation onward is a canonical id rather than an evergreen pointer ([model IDs and versioning](https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions)). A recompose virtual model is precisely the alias Anthropic warns about, so the spec should say who owns the pin and how a user sees which snapshot answered. That is the same argument as section 3.
- Unknown-model errors have fixed shapes per dialect. OpenAI returns `404` with `{"error":{"message":"The model \`x\` does not exist or you do not have access to it.","type":"invalid_request_error","param":null,"code":"model_not_found"}}`(well attested across client bug reports, for example [dify #13036](https://github.com/langgenius/dify/issues/13036); OpenAI's own reference does not publish the table). Anthropic returns`404 not_found_error`in the`{"type":"error","error":{...},"request_id":"..."}`envelope, with a`request-id` header on every response.

Discovery response shapes to implement: Anthropic returns `{data:[{type:"model", id, display_name, created_at, max_input_tokens, max_tokens, capabilities}], first_id, has_more, last_id}` with `limit` from 1 to 1000, default 20 ([list models](https://platform.claude.com/docs/en/api/models-list)). OpenAI returns `{object:"list", data:[{id, object:"model", created, owned_by}]}` ([list models](https://developers.openai.com/api/reference/resources/models/methods/list)). Claude Code only reads `id` and `display_name`, so the Anthropic-side payload can stay minimal.

**Recommendation.** Accept the existing slug grammar for the alias, keep the friendly name (`fast`) as the display name, and default the suggested id for Anthropic-dialect consumption to a prefixed form so discovery works. Follow LiteLLM's `hidden` flag with a per-model advertise toggle. Serve `/v1/models` on both dialects at the gateway's own base URL with no redirect and well under 3 seconds.

---

### 6. Libraries: build it, with two named exceptions

Nothing here justifies a new runtime dependency. The engine already serves over Hono (`docs/adr/0057-the-engine-serves-over-hono.md`), the config store already has schema versioning and typed-failure semantics for a newer document (`docs/adr/0062-a-schema-version-names-one-shape.md`, `docs/adr/0054-a-newer-settings-document-is-a-typed-failure.md`), and targets now span subscriptions, API keys, local runtimes, and aggregators (`docs/adr/0069`, `0070`, `0072`, `0073`). SWRR is roughly twenty lines, the ladder is a fold over a list, and the cooldown is a timestamp per target. LiteLLM and Portkey are servers to deploy, not libraries to embed in a `utilityProcess`.

Two exceptions worth a sentence each in the ADR's Alternatives section. First, `@portkey-ai/gateway` is published to npm and its config object is the closest match to the canvas semantics, so it is the only credible off-the-shelf candidate. I could not verify its license or embeddability: npm returned 403 to my fetch, and I did not substitute an unofficial source. Second, on the canvas side, React Flow ships the exact recipe for chained routers, using `getOutgoers` inside `isValidConnection` to reject a connection that would close a cycle ([prevent cycles example](https://reactflow.dev/examples/interaction/prevent-cycles), announced [2023-11-02](https://reactflow.dev/whats-new/2023-11-02)). Use it, and validate the same acyclicity in `packages/contracts` as well, since the engine reads a graph from disk that no canvas guarded.

---

### 7. Sources conflict or run thin in three places

- **Cloudflare's Universal Endpoint status.** Official docs still document the array-of-providers fallback with `cf-aig-step`. A third-party analysis claims it is deprecated in favour of Dynamic Routing. I found no official deprecation notice, so treat Cloudflare only as attribution-header precedent and do not model our config on it.
- **Codex wire API.** Community guides split between `wire_api = "chat"` and `"responses"`, with one claiming chat was removed in 0.59. OpenAI's own page says chat is supported but deprecated. I take the official wording and flag the removal as a scheduled risk.
- **Cache-affinity magnitudes.** The strongest numbers come from self-hosted KV-cache serving, not from Anthropic's or OpenAI's hosted prompt caches. No vendor publishes the hosted-cache hit-rate penalty of round-robin across accounts. The direction is well supported, the magnitude is not.

### 8. The four scenarios I would insist the spec carries

1. A gateway alias arrives on `/v1/messages` with `thinking: {"type": "adaptive"}` and the resolved target rejects it. Sourced from the gateway protocol reference, and it will happen on the first Ollama or older-Claude target.
2. The topmost rung returns `429` with `retry-after: 12`, and the ladder both fails over now and refuses that target for at least 12 seconds.
3. The first rung fails after the stream has started, and the client receives the upstream `error` event verbatim with the attempt recorded, rather than a silently truncated response or a second `message_start`.
4. Discovery runs against the gateway and the picker shows the models it should, given the prefix filter, the 3-second budget, the redirect ban, and `x-api-key` auth.

### Sources

- [Claude Code gateway protocol reference](https://code.claude.com/docs/en/llm-gateway-protocol)
- [Claude Code other LLM gateways](https://code.claude.com/docs/en/llm-gateway)
- [Claude Code model configuration](https://code.claude.com/docs/en/model-config)
- [Anthropic API errors](https://platform.claude.com/docs/en/api/errors)
- [Anthropic streaming messages](https://platform.claude.com/docs/en/docs/build-with-claude/streaming)
- [Anthropic refusals and fallback](https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback)
- [Anthropic list models](https://platform.claude.com/docs/en/api/models-list)
- [Anthropic model IDs and versioning](https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions)
- [OpenAI list models](https://developers.openai.com/api/reference/resources/models/methods/list)
- [Codex models and the Chat Completions deprecation](https://learn.chatgpt.com/docs/models)
- [Codex configuration reference](https://developers.openai.com/codex/config-reference)
- [Envoy AI Gateway model name virtualization](https://aigateway.envoyproxy.io/docs/capabilities/traffic/model-name-virtualization/)
- [Bifrost model aliasing](https://docs.getbifrost.ai/providers/aliasing-models)
- [LiteLLM proxy config overview](https://docs.litellm.ai/docs/proxy/configs)
- [LiteLLM fallbacks and reliability](https://docs.litellm.ai/docs/proxy/reliability)
- [LiteLLM load balancing](https://docs.litellm.ai/docs/proxy/load_balancing)
- [LiteLLM response headers](https://docs.litellm.ai/docs/proxy/response_headers)
- [LiteLLM prompt-caching friendly routing issue #6784](https://github.com/BerriAI/litellm/issues/6784)
- [Portkey gateway config object](https://portkey.ai/docs/api-reference/inference-api/config-object)
- [Portkey cookbook, resilient loadbalancing with fallbacks](https://github.com/Portkey-AI/portkey-cookbook/blob/main/ai-gateway/resilient-loadbalancing-with-failure-mitigating-fallbacks.md)
- [OpenRouter model fallbacks](https://openrouter.ai/docs/guides/routing/model-fallbacks)
- [Cloudflare AI Gateway fallbacks](https://developers.cloudflare.com/ai-gateway/configuration/fallbacks/)
- [Cloudflare AI Gateway universal endpoint](https://developers.cloudflare.com/ai-gateway/usage/universal/)
- [claude-code-router routing configuration](https://musistudio.github.io/claude-code-router/docs/server/config/routing/)
- [Azure Foundry model endpoints](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/endpoints)
- [Azure switching between OpenAI and Azure OpenAI endpoints](https://learn.microsoft.com/en-us/azure/foundry-classic/openai/how-to/switching-endpoints)
- [Envoy outlier detection](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/outlier)
- [nginx smooth weighted round-robin commit](https://github.com/nginx/nginx/commit/52327e0627f49dbda1e8db695e63a4b0af4448b1)
- [smallnest/weighted reference implementation](https://github.com/smallnest/weighted)
- [React Flow prevent cycles example](https://reactflow.dev/examples/interaction/prevent-cycles)
- [React Flow getOutgoers](https://reactflow.dev/api-reference/utils/get-outgoers)
- [anthropic-sdk-python issue 1258, mid-stream SSE error status](https://github.com/anthropics/anthropic-sdk-python/issues/1258)
- [dify issue 13036, OpenAI model_not_found body](https://github.com/langgenius/dify/issues/13036)
- [TrueFoundry on KV cache routing and prefix caching](https://www.truefoundry.com/blog/kv-cache-routing-why-standard-load-balancers-break-prefix-caching-and-how-to-fix-it)
- [Red Hat, KV cache aware routing with llm-d, 2025-10-07](https://developers.redhat.com/articles/2025/10/07/master-kv-cache-aware-routing-llm-d-efficient-ai-inference)
