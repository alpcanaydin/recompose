# Technical research brief: `provider-api-keys` (tier full)

## Scope note and a caveat on evidence

I inspected the `api-keys` worktree at branch `main`. **`openspec/changes/provider-api-keys/` does not exist yet** (no `proposal.md`, no `tasks.md`), and neither does an `openspec/specs/api-keys/spec.md`. So this brief is grounded in the shipped contracts and the neighbouring subscriptions capability rather than in a written proposal. If a proposal already exists on another branch, re-check my read of the requirement before acting on section 8.

Second caveat: this run had no shell and no glob tool, only file reads. I could not enumerate directories, so I verified the main-process and contracts surfaces by path and could not locate the renderer-side provider catalog files. Treat any statement about renderer file layout as unverified.

---

## 1. What the repository already has

| Concern                     | Where                                                                                                                                                                                                               | State                                                                                                                                                                                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account row schema          | `packages/contracts/src/accounts.ts`                                                                                                                                                                                | `ACCOUNTS_VERSION = 2`. `credentialedAccountKindSchema = z.enum(['api-key', 'aggregator'])`. `credentialedAccountSchema` is a `z.strictObject` carrying `id`, `provider` (free-form `nonBlankString`), `kind`, `label`, `credentialRef`. **No `baseUrl`, no dialect, no standing field.** |
| Connect request             | `packages/contracts/src/ipc.ts`                                                                                                                                                                                     | `connectAccountRequestSchema` takes `provider`, `kind`, `label`, `secret`. **No base URL, no dialect, no verification step.**                                                                                                                                                             |
| Connect/remove flow         | `apps/desktop/src/main/ipc/storage-ipc.ts`                                                                                                                                                                          | `connectAccount` mints `cred-${randomUUID()}`, writes the secret, appends the row. `releaseKeyRow` deletes the vault entry on removal. Serialised through `inVaultOrder`.                                                                                                                 |
| Vault                       | `apps/desktop/src/main/storage/vault.ts`                                                                                                                                                                            | `schemaVersion: 1`, `entries: Record<string, string>`, flat map with no schema over the keys, so new refs are additive.                                                                                                                                                                   |
| Encryption codec            | `apps/desktop/src/main/storage/safe-storage-codec.ts`                                                                                                                                                               | **Synchronous** `safeStorage.encryptString` / `decryptString`, base64 at rest, `isPlaintextFallback` computed from `getSelectedStorageBackend() === 'basic_text'` on Linux only.                                                                                                          |
| Typed failures              | `packages/contracts/src/ipc.ts`                                                                                                                                                                                     | `ipcErrorSchema` enumerates 11 codes. None covers a rejected key or an unreachable endpoint.                                                                                                                                                                                              |
| Target wiring               | `packages/contracts/src/gateway-config.ts`                                                                                                                                                                          | `targetSchema` carries `accountId` + `providerModel` (free-form `nonBlankString`). Model IDs are untyped text today.                                                                                                                                                                      |
| Prior decisions             | `docs/adr/0016-storage-architecture.md`, `docs/adr/0047-gateway-token-vault-and-clipboard.md`, `docs/adr/0069-subscriptions-delegate-to-the-providers-tool.md`, `docs/adr/0062-a-schema-version-names-one-shape.md` | ADR 0047 declares itself the precedent every later secret-bearing feature inherits: "mint in main, mask on the way out, and act on the plaintext in main."                                                                                                                                |
| Existing behaviour contract | `openspec/specs/subscriptions/spec.md`                                                                                                                                                                              | Already constrains the key path: "A key pick MUST ask for the key alone, because the provider and the account's name ride in from the picked entry." That implies a catalog supplies provider identity, and by extension the base URL, for catalog providers.                             |

Consequence for planning: adding any field to `credentialedAccountSchema` requires `ACCOUNTS_VERSION = 3` plus a migration, because the object is strict. The v1 to v2 migration already in `packages/contracts/src/accounts.ts` (`subscriptionRowsHeldPastedSecrets`) is the shape to copy, and `docs/adr/0062-a-schema-version-names-one-shape.md` is the governing decision.

---

## 2. Finding: verify a key for free, and pick the endpoint per dialect

Both vendors expose a zero-cost authenticated read, and Anthropic exposes something better.

- **Anthropic list models**: `GET /v1/models`, documented curl uses `-H 'anthropic-version: 2023-06-01' -H "X-Api-Key: $ANTHROPIC_API_KEY"` ([List Models](https://platform.claude.com/docs/en/api/models-list)). The version header is not optional: "When making API requests, you must send an `anthropic-version` request header" ([Versions](https://platform.claude.com/docs/en/api/versioning)).
- **Anthropic count tokens**: `POST /v1/messages/count_tokens`. The docs state plainly that "Token counting is **free to use** but subject to requests per minute rate limits", and that "Token counting and message creation have separate and independent rate limits" ([Token counting](https://platform.claude.com/docs/en/docs/build-with-claude/token-counting)). This is the stronger check because it exercises the key, the base URL, **and** the model id on the same path the gateway will actually serve (`/v1/messages…`), at no cost and against a rate-limit bucket that cannot starve real traffic.
- **OpenAI list models**: `GET /v1/models` with `Authorization: Bearer`. No body, no inference, so no spend. I could not fetch `platform.openai.com` (403 to this tool), so the endpoint shape here rests on secondary sources ([community discussion](https://community.openai.com/t/does-v1-models-only-list-models-accessible-to-the-caller/942400), [BentoML on OpenAI-compatible APIs](https://bentoml.com/llm/model-interaction/openai-compatible-api)). Flag as medium confidence on the exact doc wording, high confidence on the behaviour.

**Two caveats that belong in the acceptance criteria, not in a comment.**

1. **Authenticating is not the same as being able to spend.** Anthropic returns a distinct `402 billing_error` ("There's an issue with your billing or payment information") that only a spend attempt surfaces, alongside `401 authentication_error` and `403 permission_error` ([Errors](https://platform.claude.com/docs/en/api/errors)). A key that passes `/v1/models` can still fail the first real request. The screen should say "the key authenticates" rather than "the key works".
2. **OpenAI-compatible servers frequently do not validate the key at all.** "Most inference frameworks don't validate this value, so you can pass anything like `api_key='EMPTY'`" ([BentoML](https://bentoml.com/llm/model-interaction/openai-compatible-api)). A 200 from a self-hosted or proxy backend proves reachability, not authentication. Do not let the UI claim otherwise for a custom endpoint.

**Recommendation.** One verify action per dialect, run in main, returning a typed result. Anthropic dialect goes to `count_tokens` with a one-token message and the chosen model. OpenAI dialect goes to `GET /v1/models`. Map upstream 401/403 to a `key-rejected` failure, 402 and 429-with-`insufficient_quota` to a `billing` failure, transport errors to `endpoint-unreachable`, and everything else to a generic failure that names the status. Those codes are new entries in `ipcErrorSchema`.

---

## 3. Finding: the `/v1` ambiguity is real, dialect-dependent, and already solved by prior art

There is no cross-ecosystem convention. The two dialects pull in opposite directions.

- **OpenAI dialect wants the version segment in the base URL.** Continue documents `apiBase: http://localhost:8000/v1` and no trailing slash ([Continue OpenAI provider](https://docs.continue.dev/customize/model-providers/top-level/openai), [config.yaml reference](https://docs.continue.dev/reference)). LiteLLM warns "Do NOT add anything additional to the base url e.g. `/v1/embedding`" because the OpenAI client appends the operation path itself ([LiteLLM OpenAI-compatible](https://docs.litellm.ai/docs/providers/openai_compatible)).
- **Anthropic dialect wants the root.** LibreChat documents that for `provider: anthropic` you point `baseURL` at the API root such as `https://api.anthropic.com`, "since LibreChat uses the native Messages path itself" ([LibreChat custom endpoint](https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/custom_endpoint)).
- **Third-party Anthropic-compatible hosts publish root-shaped URLs.** MiniMax documents `https://api.minimax.io/v1` for OpenAI clients and `https://api.minimax.io/anthropic` for Anthropic clients, with the full route being `https://api.minimax.io/anthropic/v1/messages` ([MiniMax Anthropic API](https://platform.minimax.io/docs/api-reference/text-anthropic-api)). Moonshot documents `ANTHROPIC_BASE_URL=https://api.moonshot.ai/anthropic` ([Kimi-K2 issue #129](https://github.com/MoonshotAI/Kimi-K2/issues/129)). The double-`/v1` 404 is a recurring defect class in exactly this seam.
- **Trailing slashes break things.** Open WebUI documents that the Gemini compatibility URL must be exactly `https://generativelanguage.googleapis.com/v1beta/openai` "without a trailing slash", because a trailing slash breaks the `/models` call ([Open WebUI OpenAI-compatible](https://docs.openwebui.com/getting-started/quick-start/connect-a-provider/starting-with-openai-compatible/)).

**The best-documented normalisation rule comes from VS Code.** Its Custom Endpoint provider "supports three API types, which you can select per provider or per model: Chat Completions, Responses, and the Anthropic Messages API", and its URL rule is: "if the URL contains an explicit API path like `/chat/completions`, it's used as-is; otherwise VS Code appends the path for the API type, inserting `/v1` if absent" ([VS Code language models](https://code.visualstudio.com/docs/copilot/customization/language-models)).

**Recommendation.** Store the base URL exactly as the person entered it, minus a trailing slash, and resolve the request path with the VS Code rule, keyed off the dialect. Show the fully resolved URL back to the person in the connect sheet before they save, the way `openspec/specs/gateways/spec.md` already requires the creation sheet to preview the address a gateway serves. That single preview kills the entire double-`/v1` defect class by making the resolution visible instead of guessed.

---

## 4. Finding: ask for the dialect, never probe for it

Every product with real docs asks. VS Code asks (three API types, per provider or per model). LibreChat asks (`provider: anthropic` versus the OpenAI default). Continue asks (`provider: openai`). None of them sniffs.

Probing would mean an unauthenticated or authenticated request to an unknown host to guess a shape, which multiplies the failure modes and the exfiltration surface for nothing. Ask, and let the catalog pre-fill the answer for known providers.

There is a second, subtler reason to keep the dialect explicit on the account row: Claude Code's own context-window detection breaks for third-party Anthropic-compatible hosts because `isFirstPartyAnthropicBaseUrl()` returns false and capability lookup falls through to a hardcoded default ([claude-code issue #46416](https://github.com/anthropics/claude-code/issues/46416)). Anything recompose derives from "is this the first-party host" needs the host and the dialect recorded separately, not inferred from one another.

---

## 5. Finding: do not validate key format, and Anthropic keys can now expire

**No format validation.** Neither vendor's key carries a checksum, so a client cannot tell a well-formed fake from a real key; only an API call confirms validity. GitHub's secret-scanning partner list does carry `anthropic_api_key`, `anthropic_admin_api_key`, `anthropic_session_id`, `openai_api_key`, and separately `OpenRouter API Key` and `Azure OpenAI Key` ([supported patterns](https://docs.github.com/en/code-security/secret-scanning/introduction/supported-secret-scanning-patterns)). That list is useful for the repository's own hygiene. It is the wrong thing to reimplement as an input mask, because a prefix regex adds a rejection path that fires on legitimate keys from Azure, from a proxy, or from next year's prefix. Evidence on the exact prefix inventory (`sk-proj-`, `sk-svcacct-`, `sk-admin-`, `sk-ant-api03-`) is almost entirely third-party in what I could reach, which is itself an argument against encoding it. Validate non-blank, trim surrounding whitespace, and let the verify call be the judge.

**Anthropic API keys now expire, and this is new.** "When you create an API key from the API keys page in the Claude Console, you choose an expiration: a preset (3 hours, 1 day, 7 days, or 30 days), a custom duration, or **Never**." And: "After a key expires, requests made with it return a `401 authentication_error`. Create a new key to restore access; expired keys cannot be reactivated." Expiration is set at creation and cannot be changed afterwards ([Authentication](https://platform.claude.com/docs/en/manage-claude/authentication)).

This is load-bearing for the feature. A key account can lapse exactly the way a subscription can, and recompose cannot distinguish expiry from revocation without making a call, because both surface as 401. `openspec/specs/subscriptions/spec.md` already carries the requirement shape for this: "A lapsed account carries its own way back", with the remedy on the row rather than in a banner. Reuse that requirement verbatim for keys, with one difference. A lapsed subscription is restored by re-running the tool's sign-in. A lapsed key is restored only by pasting a new one, since the old value is unrecoverable.

---

## 6. Finding: the entry field wants a reveal toggle, which is the opposite of ADR 0047

`docs/adr/0047-gateway-token-vault-and-clipboard.md` rejected a reveal action, and its own reasoning tells you why the key field is different: "Identity guidance recommends that a verifier offer to display a secret while a person types it, and that guidance covers secrets people type. Nobody types this one."

A provider key is pasted by the person, so the guidance applies directly. NIST SP 800-63B-4 §3.1.1.2 says verifiers "**SHALL** allow the use of password managers and autofill functionality", "**SHOULD** permit claimants to use the 'paste' function when entering a password", and "**SHOULD** offer an option to display the password, rather than a series of dots or asterisks, while it is entered and until it is submitted to the verifier" ([NIST SP 800-63B-4, Authenticators](https://pages.nist.gov/800-63-4/sp800-63b/authenticators/)).

**After** storage, the industry norm is one-way masking to the tail. OpenAI shows the full secret only in the creation dialog and only the last four characters thereafter ([OpenAI Help Center](https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key)).

**Recommendation.** Reveal-while-entering in the connect sheet, paste allowed, no reveal once stored. On the mask itself there is a genuine trade-off. `maskGatewayToken` in `apps/desktop/src/main/settings/gateway-token.ts` echoes a fixed `rc-local-` prefix because there is exactly one gateway token. Echoing a provider key's prefix would help a person match a row to a console entry, the way OpenAI's `sk-...abcd` does, but it also publishes the key class on screen and in any screenshot, and the row already names the provider. My recommendation is last four only, and to record the reasoning in the ADR rather than leave it as a silent divergence from ADR 0047's shape.

---

## 7. Finding: catalog data has a credible off-the-shelf source, and I recommend not depending on it yet

[models.dev](https://models.dev/) is an open-source database of AI model specifications covering 75-plus providers, MIT licensed, serving `api.json`, `models.json`, and `catalog.json`, with provider entries stored as TOML. The provider schema is exactly the shape a connect catalog needs: `name` ("Display name of the provider"), `npm`, `env` ("Environment variable keys used for auth"), `doc`, and an optional `api` ("OpenAI-compatible API endpoint", "Required only when using `@ai-sdk/openai-compatible`") ([README](https://github.com/anomalyco/models.dev/blob/dev/README.md)). There is an official SDK, `@opencode-ai/models`, which is type-safe and "exports the latest snapshot for offline use".

The offline snapshot matters, because recompose is offline-first with no telemetry by its own README, and a runtime fetch of a third-party catalog on app open would contradict that posture.

**Recommendation.** Do not take the dependency in this feature. Hand-curate a small seed catalog in `packages/contracts` for the providers the release actually supports, with base URL and dialect per entry, and cite models.dev in the ADR as the reference dataset and the future path if the catalog outgrows hand curation. That is the YAGNI call, and it keeps the catalog under the same zod-and-migration discipline as everything else in `packages/contracts`.

One aggregator-specific gift worth spending: OpenRouter documents `GET https://openrouter.ai/api/v1/key`, returning `label`, `limit`, `limit_remaining`, `usage`, and `is_free_tier` ([OpenRouter limits](https://openrouter.ai/docs/api-reference/limits)). That single call verifies the key at zero cost **and** hands back a human label for the row, which is more than the `aggregator` kind can get any other way. Its `HTTP-Referer` and `X-OpenRouter-Title` headers are documented as optional ([API overview](https://openrouter.ai/docs/api-reference/overview)), so skip them.

---

## 8. Finding: the base URL is an exfiltration path, and the threat model is not textbook SSRF

Classic SSRF is an attacker steering a trusted server's requests. Here the person supplies the URL on their own machine, so the OWASP allowlist advice does not transplant cleanly ([SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)). The real risk is narrower and more likely: **a typo'd or hostile base URL sends the person's provider key to the wrong host**, in plaintext if the scheme is `http`.

The parts of the OWASP guidance that do carry over are cheap: restrict the scheme to `http` and `https`, reject a URL carrying userinfo (`http://user@host/`), and either disable redirect following or re-validate after every hop, since "an allowed host that returns 30x to an internal target turns into SSRF". And note the desktop inversion, which OWASP does not cover: loopback must be **allowed** on purpose, because pointing at Ollama or LM Studio on `localhost` is a first-class use case.

**Recommendation.** Accept `https` for any host. Accept `http` only for loopback and private-range hosts, and say on screen that the key travels unencrypted when they do. Refuse any other scheme and any userinfo component as a parse error in the zod schema, so the refusal is structural rather than a review note, matching the technique ADR 0069 used for the subscription-credential prohibition. Do not follow redirects on the verify call.

---

## 9. Finding: never let an upstream error body reach the screen verbatim

The OWASP Logging Cheat Sheet's "Data to exclude" section names "Access tokens", "Authentication passwords", and "Encryption keys and other primary secrets" among items that must be "removed, masked, sanitized, hashed, or encrypted" before they enter a log ([Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)).

This is not hypothetical for this feature. OpenAI's own "Incorrect API key provided" guidance tells people to compare the key on the console against "the one in the error message" ([OpenAI Help Center](https://help.openai.com/en/articles/6882433-incorrect-api-key-provided)), which means the upstream 401 body can carry key material. If recompose forwards that body into an `IpcError.message`, the key lands in the renderer, in a screenshot, and in whatever the person was sharing. `docs/adr/0047-gateway-token-vault-and-clipboard.md` went out of its way to keep the gateway token out of the renderer; forwarding a provider error verbatim would undo that for a bigger secret.

**Recommendation.** The verify path returns recompose's own typed failure with recompose's own wording. Upstream status codes may cross the bridge. Upstream bodies may not.

---

## 10. Adjacent finding, and my recommendation to keep it out of scope

Electron's `safeStorage` docs now say "We recommend using the asynchronous API (`encryptStringAsync`/`decryptStringAsync`) over the synchronous API", that the async API "is non-blocking, supports key rotation, and handles temporary unavailability gracefully", and that "The synchronous API may be deprecated in a future version of Electron" ([safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage), [docs source](https://github.com/electron/electron/blob/main/docs/api/safe-storage.md)). `decryptStringAsync` resolves with a `shouldReEncrypt` flag, and "If `true`, you should call `decryptStringAsync` again". The async surface landed via [PR #49054](https://github.com/electron/electron/pull/49054) (merged 2026-02-15, `os_crypt_async`) with a lazy-initialisation fix in [PR #50419](https://github.com/electron/electron/pull/50419) and an `isAsyncEncryptionAvailable` correctness fix in [v42.4.1](https://github.com/electron/electron/releases/tag/v42.4.1). `apps/desktop/package.json` pins `electron` at `43.2.0`, so it is available here.

The async path also unlocks the Linux Portal Secret provider, "the preferred provider for sandboxed environments like Flatpak", which the sync path does not reach.

**Recommendation: do not migrate in this feature.** `SecretCodec` in `apps/desktop/src/main/storage/safe-storage-codec.ts` is synchronous, and `setSecret` / `getSecret` in `apps/desktop/src/main/storage/vault.ts` are pure synchronous functions over the codec. Making them async touches every vault caller including the gateway-token paths, and `shouldReEncrypt` introduces a write on a read path that the current single-writer model does not contemplate. That is its own change with its own ADR. This feature adds entries to a flat map with no schema over its keys, so nothing about it blocks the later migration. Log it as a rider.

Related, unchanged, and worth restating because a key is more valuable than a gateway token: on Linux with no secret store, `safeStorage` items "will be unprotected as they are encrypted via hardcoded plaintext password", detectable through `getSelectedStorageBackend() === 'basic_text'`. `docs/adr/0016-storage-architecture.md` already requires that fallback to reach the person as a visible warning, and `docs/adr/0047-gateway-token-vault-and-clipboard.md` reports it as `plaintext-fallback`. The key connect sheet must carry the same warning **before** the paste, not after, because an unrecoverable secret written to a plaintext store is worse than a regenerable local token written there.

---

## 11. Where the sources conflict or the evidence is thin

1. **The `/v1` convention has no winner.** LiteLLM says do not append sub-paths but ships providers both with and without `/v1`; LibreChat says root for Anthropic and `/v1` for OpenAI; Open WebUI says whatever prefix the provider uses, and a trailing slash is a defect. This is a genuine ecosystem disagreement, not a gap in my search. That is exactly why I recommend the visible-resolution approach in section 3 rather than picking a rule and documenting it.
2. **OpenAI platform docs were unreachable** to this tool (403 on `platform.openai.com`). The `GET /v1/models` shape and the key-prefix inventory rest on community and third-party sources. Anyone writing the spec should re-verify those two points against the official reference.
3. **Storage practice in comparable Electron apps is undocumented.** I found no authoritative statement on how Cherry Studio, Jan, or LM Studio encrypt provider keys at rest. Jan's docs reference a plain `store.json` for app state, which is suggestive but not evidence about credentials. Do not cite "everyone uses safeStorage" as prior art, because I could not establish it. The negative examples are better sourced: two recent local-AI tools shipped provider keys in plaintext config or exposed them over an unauthenticated endpoint ([Vane issue #1122](https://github.com/ItzCrazyKns/Vane/issues/1122)).
4. **Anthropic key-expiry presets** are documented, but I found nothing on how a client should present a key whose expiry it cannot read. There is no client-visible expiry field on a key; `expires_at` is exposed only through the Admin API, which needs a separate admin key. So recompose can report "authenticated as of last check" and nothing more. Do not promise a countdown.

---

## 12. Recommendation summary

1. Bump `ACCOUNTS_VERSION` to 3, add `baseUrl` and `dialect` to `credentialedAccountSchema` with a stepwise migration, following the v1-to-v2 precedent in `packages/contracts/src/accounts.ts` and `docs/adr/0062-a-schema-version-names-one-shape.md`.
2. Encode the scheme and userinfo restrictions in the zod schema so a forbidden URL is a parse error, mirroring how ADR 0069 made the subscription-credential prohibition unrepresentable.
3. Ask for the dialect. Never probe. Pre-fill it from a hand-curated seed catalog in `packages/contracts`, citing models.dev as the reference dataset without depending on it.
4. Preview the fully resolved request URL in the connect sheet, resolved by the VS Code rule.
5. One verify action per dialect, run in main, zero cost: `count_tokens` for Anthropic, `GET /v1/models` for OpenAI, `GET /api/v1/key` for OpenRouter. Add `key-rejected`, `endpoint-unreachable`, and a billing code to `ipcErrorSchema`.
6. Reveal-while-entering plus paste in the sheet; last-four masking once stored; no reveal ever afterwards.
7. Give a key account a standing, reuse the lapsed-row requirement from `openspec/specs/subscriptions/spec.md`, and word the remedy as "paste a new key" rather than "restore".
8. Never forward an upstream error body to the renderer.
9. Show the `plaintext-fallback` warning before the paste, not after.
10. File the sync-to-async `safeStorage` migration as a rider with its own ADR.

## 13. Suggested acceptance criteria worth hunting for in the spec

Phrased as behaviour, since `.claude/rules/tdd-bdd.md` wants scenarios that read to someone who has never seen the implementation.

- A key that authenticates but cannot spend reports as authenticated, not as working.
- A custom OpenAI-compatible endpoint that returns 200 for any key does not report the key as verified.
- A base URL the person enters with a trailing slash resolves to the same request path as one without.
- A base URL already carrying an explicit operation path is used as given rather than having a path appended.
- An `http` base URL naming a non-loopback host is refused at parse time.
- A URL carrying userinfo is refused at parse time.
- A verify call that meets a redirect does not follow it.
- An expired Anthropic key surfaces as lapsed on its own row with the remedy on that row.
- The stored key never crosses the bridge, and the settings and accounts types carry no key property, asserted at the type level per `docs/adr/0023-type-level-tests.md`.
- An upstream 401 body containing key material never appears in an `IpcError.message`.
- Removing a key account deletes its vault entry, which `releaseKeyRow` in `apps/desktop/src/main/ipc/storage-ipc.ts` already does and which should stay covered.
