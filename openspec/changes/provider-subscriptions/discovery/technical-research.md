# Technical research: provider subscriptions

Retrieved 2026-08-01. Every claim below carries a source. Where the evidence is secondary or thin, the text says so.

## Bottom line

The feature as the repository currently advertises it is partly prohibited and partly already blocked on the wire. `README.md` (line 31) promises "sign in with OAuth for Claude and Codex subscriptions." For Claude that promise cannot be kept: Anthropic's published policy forbids it, and Anthropic has enforced the ban server side since 2026-01-09. For Codex it is unsettled rather than sanctioned.

There is, however, a first-party documented path that delivers most of the user value without recompose ever holding a subscription credential. Anthropic's own gateway protocol reference describes and supports a gateway sitting behind `ANTHROPIC_BASE_URL` while the developer's claude.ai login stays the active credential. That is a pass-through design, not a sign-in design, and it is the recommendation below.

## 1. Per-provider legality of subscription sign-in

### 1.1 Anthropic (Claude Pro, Max): prohibited and blocked

Anthropic's Claude Code legal page states it directly under "Authentication and credential use":

> OAuth authentication is intended exclusively for purchasers of Claude Free, Pro, Max, Team, and Enterprise subscription plans and is designed to support ordinary use of Claude Code and other native Anthropic applications.

> Developers building products or services that interact with Claude's capabilities, including those using the Agent SDK, should use API key authentication through Claude Console or a supported cloud provider. Anthropic does not permit third-party developers to offer Claude.ai login or to route requests through Free, Pro, or Max plan credentials on behalf of their users.

> Anthropic reserves the right to take measures to enforce these restrictions and may do so without prior notice.

Source: [Legal and compliance, Claude Code docs](https://code.claude.com/docs/en/legal-and-compliance) (no publication date on the page; secondary reporting dates the section to February 2026, see [alternativeto, 2026-02](https://alternativeto.net/news/2026/2/anthropic-officially-bans-using-subscription-authentication-for-third-party-claude-use)).

Enforcement is not theoretical. On 2026-01-09 an OpenCode user filed an issue reporting the server-side rejection "This credential is only authorized for use with Claude Code and cannot be used for other API requests"; the issue was closed as not planned ([anomalyco/opencode issue 7456](https://github.com/anomalyco/opencode/issues/7456)). Secondary reporting describes the same date as the day Anthropic deployed safeguards against tools spoofing the Claude Code client, and describes a later OpenCode pull request removing Anthropic references "per legal requests" ([paddo.dev](https://paddo.dev/blog/anthropic-walled-garden-crackdown/), [falcao.org](https://falcao.org/posts/anthropic-claude-access-crackdown-ecosystem-fallout/)).

There is no registration path for a third-party Anthropic OAuth client. Anthropic's authentication doc lists the six credential sources Claude Code accepts and none of them is an OAuth client a third party owns ([Authentication, Claude Code docs](https://code.claude.com/docs/en/authentication)).

**Verdict: do not build Claude subscription sign-in. Also correct the README claim.**

### 1.2 OpenAI (ChatGPT Plus, Pro via Codex): unsettled, not sanctioned

Codex CLI's own OAuth is well documented and technically reusable. Its login server targets issuer `https://auth.openai.com`, authorize path `/oauth/authorize`, token path `/oauth/token`, PKCE `S256`, redirect `http://localhost:1455/auth/callback` with 1457 as fallback, and persists `access_token`, `refresh_token`, `id_token`, and `account_id` to `~/.codex/auth.json` or an OS keyring ([codex-rs/login/src/server.rs](https://github.com/openai/codex/blob/main/codex-rs/login/src/server.rs); [Codex authentication docs](https://learn.chatgpt.com/docs/auth.md)).

What is missing is permission. "Sign in with ChatGPT" for third-party apps was announced as an interest programme in 2025 ([TechCrunch, 2025-05-27](https://techcrunch.com/2025/05/27/openai-may-soon-let-you-sign-in-with-chatgpt-for-other-apps/)); secondary reporting says that as of April 2026 it still ships only inside Codex tooling, and the "bring your own plan" variant remains a request rather than a product ([openai/codex issue 10974](https://github.com/openai/codex/issues/10974), which returned 404 on direct fetch and is cited here only through search results). Asked whether a modified Codex CLI using ChatGPT sign-in complies with the Terms of Use, an OpenAI maintainer confirmed the Apache licence permits forking and pointed at the Terms, without confirming the auth question ([openai/codex discussion 8338, 2025-12-19](https://github.com/openai/codex/discussions/8338)).

Reusing Codex's `client_id` from recompose is client impersonation of the same kind Anthropic blocked. Nothing suggests OpenAI has blocked it yet, but the only sources for "not blocked" are secondary blog posts, and the absence of enforcement is not permission.

**Verdict: treat Codex subscription sign-in as an accepted-risk item that needs an explicit maintainer decision, not a default.**

### 1.3 Google (Gemini CLI, Code Assist): prohibited

Search results quote the Gemini CLI terms as stating that "directly accessing the services powering Gemini CLI using third-party software, tools, or services ... is a violation of applicable terms and policies" and may be grounds for account suspension or termination. The primary page fetched cleanly but did not contain that paragraph in the retrieved extract ([Gemini CLI terms of service and privacy notices](https://google-gemini.github.io/gemini-cli/docs/tos-privacy.html)); the quotation therefore rests on the search index rather than on a page fetch I could verify. Treat the direction as reliable and the exact wording as unverified.

### 1.4 GitHub Copilot: prohibited

Community answers from GitHub state that the Copilot inference endpoint is intended solely for officially supported Copilot clients and that using it as a generic model provider violates the Terms and the Copilot licence ([GitHub community discussion 178117](https://github.com/orgs/community/discussions/178117), [discussion 181711](https://github.com/orgs/community/discussions/181711)). Note the separate and permitted product: GitHub Models exposes `https://models.github.ai/inference` to any client holding a personal access token with `models:read`, is OpenAI-compatible, and is rate limited by plan ([Prototyping with AI models, GitHub Docs](https://docs.github.com/en/github-models/use-github-models/prototyping-with-ai-models)).

### 1.5 Providers that do permit third-party OAuth

Two vendors ship exactly the flow this feature wants, on purpose:

- **OpenRouter** documents an OAuth PKCE flow for third-party apps. Authorization at `https://openrouter.ai/auth`, exchange at `https://openrouter.ai/api/v1/auth/keys`, `S256` recommended, and desktop or CLI apps may use a loopback callback on any port such as `http://localhost:51423/callback`. The exchange yields a user-controlled API key ([OpenRouter OAuth PKCE docs](https://openrouter.ai/docs/use-cases/oauth-pkce)).
- **Hugging Face** supports public OAuth apps with no client secret, authorization code with PKCE and device code, discovery at `https://huggingface.co/.well-known/openid-configuration`, and an `inference-api` scope described as "make inference requests on behalf of the user" ([Sign in with Hugging Face](https://huggingface.co/docs/hub/en/oauth)).

These are the honest way to ship a "connect your account, your plan pays" row.

## 2. The path Anthropic itself documents for a gateway

This is the most important finding for the design, and it is first-party.

From "Other LLM gateways", under "Subscriptions and gateways":

> `ANTHROPIC_BASE_URL` is the variable that points Claude Code at the gateway. Setting only that variable, without a gateway credential, doesn't replace the subscription. Requests still route through the gateway, but a saved claude.ai login remains the active credential, so its usage limits and billing apply. Gateways that pass this traffic on to Anthropic must forward the OAuth capability in `anthropic-beta`.

Source: [Other LLM gateways, Claude Code docs](https://code.claude.com/docs/en/llm-gateway).

So a recompose gateway can carry subscription traffic without recompose ever storing, minting, or refreshing a Claude credential. The credential stays in Claude Code. recompose forwards it. The gateway protocol reference gives the contract ([Gateway protocol reference](https://code.claude.com/docs/en/llm-gateway-protocol)):

- **Format and endpoints.** `ANTHROPIC_BASE_URL` selects the Anthropic Messages format: `/v1/messages`, plus optional `/v1/messages/count_tokens`. Inference posts to `/v1/messages?beta=true`, so match on path, not full URL. A `HEAD /` connectivity probe arrives at startup and may be rejected.
- **Headers to forward unchanged.** `anthropic-version` (currently `2023-06-01`) and `anthropic-beta`. On `anthropic-beta` the doc is explicit: "Forward the header verbatim; don't allowlist individual values ... When the developer authenticates with a claude.ai login ... this header also carries an OAuth capability that the upstream requires, and stripping it fails those requests with `401`." The doc does not name the capability string; third-party reports name it `oauth-2025-04-20` ([anthropics/claude-code issue 13770](https://github.com/anthropics/claude-code/issues/13770)), and that specific string is secondary evidence. Do not pin to it. Forward the header whole.
- **Headers recompose may consume.** `x-claude-code-session-id`, `x-claude-code-agent-id`, `x-claude-code-parent-agent-id`. These are free attribution keys for the usage log ADR-0016 planned, and the doc warns they identify an agent, never a person.
- **Streaming is mandatory.** "Inference responses must stream ... a gateway that buffers complete responses before relaying them stalls the client."
- **Errors pass through unmodified.** Claude Code's automatic retry matches on the upstream's error wording, so wrapping an upstream error in an envelope breaks recovery even when the status code survives.
- **The `system` array passes through unchanged.** Claude Code prepends an attribution block that `api.anthropic.com` strips positionally. Reordering, merging, or stringifying the array defeats the strip and poisons the prompt cache key.
- **Model discovery.** Optional `GET /v1/models?limit=1000`, 3-second timeout, redirects treated as failure, only ids starting with `claude` or `anthropic` are kept, enabled client side by `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1`.

The same page also gives the honest limit of the failover story: "Anthropic ... doesn't support routing Claude Code to non-Claude models through any gateway" ([Other LLM gateways](https://code.claude.com/docs/en/llm-gateway)). A failover ladder that drops a Claude Code session onto an OpenAI target is outside what Anthropic supports.

**Codex analogue.** Codex's config reference exposes `model_providers.<id>.base_url` and `model_providers.<id>.requires_openai_auth` ("The provider uses OpenAI authentication (defaults to false)"), which is the equivalent pass-through hook, and `wire_api` where "`responses` is the only supported value" ([Codex config reference](https://learn.chatgpt.com/docs/config-file/config-reference)). Codex therefore speaks the Responses API, not `/v1/chat/completions`. The ChatGPT-plan bearer travels with a `ChatGPT-Account-ID` header against `https://chatgpt.com/backend-api/codex` ([codex-rs/core/src/model_provider_info.rs](https://github.com/openai/codex/blob/main/codex-rs/core/src/model_provider_info.rs)). That is a scope question the README already implies is solved: "point clients such as Claude Code, Codex, and Cursor at one local endpoint" is not true for Codex until recompose serves `/v1/responses`.

## 3. Standards, if OAuth is implemented for the permitted providers

- **RFC 8252, OAuth 2.0 for Native Apps** (BCP 212, October 2017). Section 4: authorization requests go through an external user-agent, typically the browser. Section 8.12: "native apps MUST NOT use embedded user-agents to perform authorization requests." Section 7.3: loopback redirect URIs use `http`, are built from the loopback IP literal rather than `localhost` ("avoids inadvertently listening on network interfaces other than the loopback interface"), and the authorization server "MUST allow any port to be specified at the time of the request." Section 8.3: plain `http` on loopback is acceptable because the request never leaves the device. ([RFC 8252](https://www.rfc-editor.org/rfc/rfc8252.html))
- **RFC 7636, PKCE.** Section 6 of RFC 8252 makes it mandatory: "Public native app clients MUST implement the Proof Key for Code Exchange (PKCE) extension." Use `S256`.
- **RFC 9700 / BCP 240, Best Current Practice for OAuth 2.0 Security** (2025). Public clients MUST use PKCE; authorization servers MUST use exact redirect-URI string matching except for the port in loopback URIs for native apps ([RFC 9700 info](https://www.rfc-editor.org/info/rfc9700/)).
- **RFC 8628, Device Authorization Grant.** The fallback when no browser or no loopback bind is available. Codex ships `codex login --device-auth` ([Codex authentication docs](https://learn.chatgpt.com/docs/auth.md)); Hugging Face ships `POST https://huggingface.co/oauth/device` ([HF OAuth docs](https://huggingface.co/docs/hub/en/oauth)). OpenRouter does not.

Fit with the existing shell: ADR-0028 (`docs/adr/0028-security-baseline.md`) already installs a deny-by-default permission handler, a `will-navigate` guard pinned to `app://renderer`, and `decideExternalOpen` that opens only `https:` targets through `shell.openExternal`. An embedded `BrowserWindow` OAuth flow is therefore both forbidden by RFC 8252 and architecturally blocked already. The same ADR records that "the brand scheme `recompose://` stays reserved and unregistered: no deep-link consumer exists yet," so a custom-scheme callback would be a new, cross-platform surface (macOS `open-url`, Windows and Linux `second-instance` plus cold-start `process.argv`, per [Electron deep links](https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app) and [electron/electron issue 40173](https://github.com/electron/electron/issues/40173)). A one-shot loopback listener on `127.0.0.1` avoids all of that and is what the RFC prefers.

## 4. Library options

| Option                                                                                                                            | Trade-off                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`openid-client` v6](https://github.com/panva/openid-client) (MIT, OpenID-certified, runs on Node and Electron, Node 20 baseline) | Highest-level. Covers authorization code with PKCE, device authorization grant, and refresh grant, and can be configured without a discovery document. Cost: a new runtime dependency in a `apps/desktop` package whose `dependencies` block currently holds three entries. |
| [`oauth4webapi`](https://github.com/panva/oauth4webapi) (MIT, zero dependencies, tree-shakeable ESM, same author)                 | Low-level, same grant coverage, nothing to configure that the spec does not name. Better fit for a codebase that prefers explicit domain code.                                                                                                                              |
| Hand-rolled over `node:crypto` and `node:http`                                                                                    | OpenRouter's exchange is not a standard token endpoint (`POST /api/v1/auth/keys` with `code` and `code_verifier`), so a library buys little there. Roughly a verifier, an `S256` challenge, a `state` value, a one-shot loopback server, and a fetch.                       |

Recommendation: if only OpenRouter lands first, hand-roll it and skip the dependency. If Hugging Face lands too, take `oauth4webapi`, because HF is real OIDC with discovery and the zero-dependency footprint matches the repository's posture. Reserve `openid-client` for the case where device flow and discovery both become load-bearing.

## 5. Credential storage

The repository already holds the answer and the precedent, so this needs no new decision, only an extension.

- ADR-0016 (`docs/adr/0016-storage-architecture.md`) puts secrets in a `safeStorage`-encrypted `vault.bin` keyed by `credentialRef`, with `accounts.json` as the cross-gateway registry, main as the single writer, and secrets that "flow, never rest, outside the vault."
- ADR-0047 (`docs/adr/0047-gateway-token-vault-and-clipboard.md`) sets the shape every later secret-bearing feature inherits: mint in main, mask on the way out, act on the plaintext in main. It states this explicitly as precedent.
- `apps/desktop/src/main/storage/vault.ts` stores `entries: Record<string, string>` of encrypted strings, so an OAuth token set (access token, refresh token, expiry, account id) fits under one `credentialRef` as a serialised JSON string with no vault schema change.
- `packages/contracts/src/accounts.ts` already declares `accountKindSchema = z.enum(['subscription', 'api-key', 'aggregator'])` and one `credentialRef` per account. The `subscription` arm exists and is unused. What it lacks is any non-secret metadata a refresh scheduler needs (expiry, issuer, scopes) without opening the vault on every tick.
- `apps/desktop/src/main/ipc/storage-ipc.ts` `connectAccount` takes a single opaque `secret` string, which is compatible with the serialised-token-set approach and needs no channel redesign.
- Electron's own docs warn that when no secret store exists, `safeStorage` values "will be unprotected as they are encrypted via hardcoded plaintext password," detectable through `getSelectedStorageBackend()` returning `basic_text`, which ADR-0016 already requires be surfaced. The same page now advises the async variants over the sync ones and notes the sync ones may be deprecated, which is a small rider against the existing codec ([Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)).

Refresh discipline worth designing for: RFC 9700 treats refresh-token rotation as the norm for public clients, which means a concurrent double-refresh can invalidate a live token. A single-flight refresh in main, plus refresh-on-401-and-retry-once at the proxy edge, is the shape to specify.

## 6. Prior art

| Project                  | What it did                                                                                                                                                                                                                                                | What it teaches                                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenCode                 | Shipped Claude subscription OAuth, was blocked 2026-01-09, closed the resulting issue as not planned, later removed Anthropic references per legal request ([issue 7456](https://github.com/anomalyco/opencode/issues/7456))                               | The exact failure mode recompose would walk into                                                                                                                  |
| LiteLLM                  | Documents Claude Max through header forwarding: the client holds the OAuth token and `forward_client_headers_to_llm_api: true` relays the `Authorization` header ([LiteLLM tutorial](https://docs.litellm.ai/docs/tutorials/claude_code_max_subscription)) | Confirms pass-through works in practice. Carries no policy disclaimer and no visible publication date, so treat it as an implementation reference, not as licence |
| Codex CLI                | Loopback callback on a fixed port with one fallback, `S256`, tokens in `auth.json` or an OS keyring, device-auth fallback ([login server](https://github.com/openai/codex/blob/main/codex-rs/login/src/server.rs))                                         | A clean reference implementation of RFC 8252 in a coding tool                                                                                                     |
| Gemini CLI               | Loopback listener with a manual paste fallback when the port is taken or the environment is headless ([opencode-gemini-auth](https://github.com/jenslys/opencode-gemini-auth))                                                                             | The degradation path worth copying for a desktop app                                                                                                              |
| OpenRouter, Hugging Face | Published, third-party-facing OAuth with localhost redirects and per-user billing                                                                                                                                                                          | The compliant shape of the feature                                                                                                                                |

## 7. Recommendation

1. **Drop Claude subscription sign-in from scope** and amend `README.md` line 31, which currently promises it. Keep Claude reachable through Console API keys and through Amazon Bedrock, Google Cloud's Agent Platform, and Microsoft Foundry, which the same Anthropic page names as the supported developer path.
2. **Reframe "subscription" as pass-through for the first-party clients.** Implement the gateway protocol contract in section 2 so a Claude Code session pointed at a recompose gateway with no credential override keeps its own claude.ai login. This is documented and supported by Anthropic, needs no credential storage, and is the strongest thing this feature can ship. It also implies concrete engine work: verbatim `anthropic-beta` and `anthropic-version` forwarding, unbuffered SSE, unmodified error bodies, an untouched `system` array, and path matching that tolerates `?beta=true`.
3. **Ship real OAuth only where a vendor invites it.** OpenRouter first, Hugging Face second. Both give the "connect an account, your plan pays" experience the feature is reaching for, legally.
4. **Put Codex subscription sign-in behind an explicit maintainer decision** recorded in the ADR, with the risk stated: it reuses a client identity recompose does not own, it is the pattern Anthropic already punished, and the only evidence that OpenAI tolerates it is secondary.
5. **Write the ADR around the credential-set extension**, not around a new storage mechanism. ADR-0016 and ADR-0047 already decide where secrets live and how they leave main.

## 8. Where the evidence is thin or conflicting

- The Gemini CLI third-party-proxy prohibition is quoted from a search index; the page I fetched did not contain that paragraph. Verify against the live terms before citing it in a spec.
- The `anthropic-beta` OAuth capability string `oauth-2025-04-20` comes from issue threads, not from Anthropic's reference. The reference deliberately declines to enumerate values and tells gateways to forward the header whole. Build to the instruction, not to the string.
- "OpenAI has not blocked third-party Codex OAuth" rests entirely on blog posts. No primary OpenAI statement either permits or forbids it. The one place a maintainer was asked directly, the answer covered the licence and not the terms ([discussion 8338](https://github.com/openai/codex/discussions/8338)).
- The LiteLLM pass-through tutorial has no visible date and no policy note. It documents a mechanism, not an entitlement.
- `openai/codex` issue 10974 returned 404 to a direct fetch and is cited only through the search index.

## 9. Open questions for the brainstorm

- Does "subscription" in the product vocabulary mean "recompose signs you in" or "recompose carries your client's own session"? Section 2 argues for the second, and that changes the whole UI surface from a sign-in button to a target type.
- Does recompose serve `/v1/responses` so Codex can point at it at all? Today's dialects are `/v1/messages` and `/v1/chat/completions`, and Codex accepts only `wire_api = "responses"`.
- A Claude Code session behind a recompose gateway cannot fail over to a non-Claude target within Anthropic's supported envelope. Does the router surface that, refuse it, or let it through with a warning?
- Do the `x-claude-code-session-id` and agent-id headers become the usage log's attribution keys, and does the engine store them?
- Where does the loopback callback listener live: main, or the engine that already binds ports per ADR-0056?

## Sources

- [Legal and compliance, Claude Code docs](https://code.claude.com/docs/en/legal-and-compliance)
- [Authentication, Claude Code docs](https://code.claude.com/docs/en/authentication)
- [Other LLM gateways, Claude Code docs](https://code.claude.com/docs/en/llm-gateway)
- [Gateway protocol reference, Claude Code docs](https://code.claude.com/docs/en/llm-gateway-protocol)
- [Claude apps gateway, Claude Code docs](https://code.claude.com/docs/en/claude-apps-gateway)
- [anomalyco/opencode issue 7456](https://github.com/anomalyco/opencode/issues/7456)
- [anthropics/claude-code issue 13770](https://github.com/anthropics/claude-code/issues/13770)
- [Anthropic officially bans using subscription authentication for third-party Claude use, alternativeto, 2026-02](https://alternativeto.net/news/2026/2/anthropic-officially-bans-using-subscription-authentication-for-third-party-claude-use)
- [Anthropic's walled garden: the Claude Code crackdown, paddo.dev](https://paddo.dev/blog/anthropic-walled-garden-crackdown/)
- [Anthropic's third-party Claude crackdown, falcao.org](https://falcao.org/posts/anthropic-claude-access-crackdown-ecosystem-fallout/)
- [Codex authentication docs](https://learn.chatgpt.com/docs/auth.md)
- [Codex config reference](https://learn.chatgpt.com/docs/config-file/config-reference)
- [openai/codex codex-rs/login/src/server.rs](https://github.com/openai/codex/blob/main/codex-rs/login/src/server.rs)
- [openai/codex codex-rs/core/src/model_provider_info.rs](https://github.com/openai/codex/blob/main/codex-rs/core/src/model_provider_info.rs)
- [openai/codex discussion 8338](https://github.com/openai/codex/discussions/8338)
- [OpenAI may soon let you sign in with ChatGPT for other apps, TechCrunch, 2025-05-27](https://techcrunch.com/2025/05/27/openai-may-soon-let-you-sign-in-with-chatgpt-for-other-apps/)
- [Gemini CLI terms of service and privacy notices](https://google-gemini.github.io/gemini-cli/docs/tos-privacy.html)
- [jenslys/opencode-gemini-auth](https://github.com/jenslys/opencode-gemini-auth)
- [GitHub community discussion 178117](https://github.com/orgs/community/discussions/178117)
- [GitHub community discussion 181711](https://github.com/orgs/community/discussions/181711)
- [Prototyping with AI models, GitHub Docs](https://docs.github.com/en/github-models/use-github-models/prototyping-with-ai-models)
- [OpenRouter OAuth PKCE](https://openrouter.ai/docs/use-cases/oauth-pkce)
- [Sign in with Hugging Face](https://huggingface.co/docs/hub/en/oauth)
- [RFC 8252, OAuth 2.0 for Native Apps](https://www.rfc-editor.org/rfc/rfc8252.html)
- [RFC 9700, Best Current Practice for OAuth 2.0 Security](https://www.rfc-editor.org/info/rfc9700/)
- [panva/openid-client](https://github.com/panva/openid-client)
- [panva/oauth4webapi](https://github.com/panva/oauth4webapi)
- [Electron safeStorage API](https://www.electronjs.org/docs/latest/api/safe-storage)
- [Electron deep links tutorial](https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app)
- [electron/electron issue 40173](https://github.com/electron/electron/issues/40173)
- [LiteLLM: using Claude Code Max subscription](https://docs.litellm.ai/docs/tutorials/claude_code_max_subscription)

Repository references used: `README.md`, `docs/adr/0016-storage-architecture.md`, `docs/adr/0028-security-baseline.md`, `docs/adr/0047-gateway-token-vault-and-clipboard.md`, `packages/contracts/src/accounts.ts`, `apps/desktop/src/main/storage/vault.ts`, `apps/desktop/src/main/ipc/storage-ipc.ts`, `apps/desktop/package.json`, `openspec/specs/gateways/spec.md`, `openspec/changes/provider-subscriptions/manifest.md`.
