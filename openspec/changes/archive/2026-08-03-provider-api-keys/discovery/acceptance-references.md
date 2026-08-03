# Acceptance references for `provider-api-keys`

Acceptance criteria drawn from vendor documentation and real failure reports. Five questions, one section each. Where documentation does not exist, this brief says so rather than guessing.

## Corrections to this brief's own limits

The arm that produced this brief had no directory enumeration and guessed two renderer paths wrongly. The shipped files stand at `apps/desktop/src/renderer/src/pages/providers/ui/`: `connect-key-form.tsx`, `account-list.tsx`, `credentialed-surface.tsx`, `credentialed-empty-state.tsx`, and `provider-connect-way.tsx`, each with a stories sibling. Verified by listing the directory on 2026-08-03.

## One local finding that is load-bearing

`nonBlankString` refuses blank but never trims:

```ts
export const nonBlankString = z
  .string()
  .refine((value) => value.trim().length > 0, 'must not be blank');
```

`connectAccountRequestSchema` uses `label: z.string().trim().min(1)` (trims) and `secret: nonBlankString` (does not). A key pasted with a trailing newline passes validation today and reaches the vault with the newline attached. Verified at `packages/contracts/src/non-blank.ts` and `packages/contracts/src/ipc.ts:44`.

`ACCOUNTS_VERSION` stands at 2, and `credentialedAccountSchema` is a `z.strictObject` holding exactly `id`, `provider`, `kind`, `label`, `credentialRef`. Any stored mask field is a schema change with a migration.

## 1. Key validation before storing

**Anthropic documents its prefix in prose.** The authentication page reads "Static `sk-ant-api...` secret in the `x-api-key` header", and the federation section says "There is no `sk-ant-api...` string to mint, distribute, or rotate" ([Authentication](https://platform.claude.com/docs/en/manage-claude/authentication)). It names a family, not a fixed generation, and the console issues admin keys as a separate secret type ([GitHub secret scanning patterns](https://docs.github.com/en/code-security/secret-scanning/introduction/supported-secret-scanning-patterns) lists `anthropic_api_key`, `anthropic_admin_api_key`, and `anthropic_session_id` separately).

**OpenAI's platform documentation was unreachable** (HTTP 403 on both `platform.openai.com` and `help.openai.com`). Everything asserting `sk-proj-`, `sk-svcacct-`, or `sk-admin-` was third party. GitGuardian records "Prefixed: True" for the OpenAI project key and that the type "is replacing legacy API keys since April 2024", without publishing the string ([GitGuardian](https://docs.gitguardian.com/secrets-detection/secrets-detection-engine/detectors/specifics/openai_project_apikey)). Treat the OpenAI prefix inventory as undocumented.

**The strongest evidence against a prefix gate is a shipped defect.** OpenClaw's `paste-token` rejected legitimate `sk-ant-api03-` keys with "Expected token starting with sk-ant-oat01-", still reproducible after an earlier fix attempt ([openclaw#72121](https://github.com/openclaw/openclaw/issues/72121)). One vendor, two legitimate token families, and the gate picked the wrong one.

**No vendor documents a key-validation endpoint.** What exists is a free authenticated read on each side. Anthropic's token counting is "free to use" with rate limits independent of message creation ([Token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting)); `GET /v1/models` also exists ([API overview](https://platform.claude.com/docs/en/api/overview)). OpenAI publishes `client.models.list()` against `get /models` in its own SDK reference ([openai-node api.md](https://raw.githubusercontent.com/openai/openai-node/master/api.md)), and a direct request to `https://api.openai.com/v1/models` answered 401 without credentials (observed 2026-08-03), so it is an authenticated read.

**Prior art ships verification as an explicit act, not a gate.** Open WebUI documents a Verify Connection control and warns that a failed verification "does **not** mean the provider is incompatible: **chat completions will still work**", listing MiniMax as a provider whose `/models` endpoint does not exist ([Open WebUI](https://docs.openwebui.com/getting-started/quick-start/connect-a-provider/starting-with-openai-compatible/)).

**A 401 does not name its cause.** Anthropic documents 401 `authentication_error` as covering a key that is "malformed, revoked, or expired" in one code, with 402 `billing_error` and 403 `permission_error` separate ([Errors](https://platform.claude.com/docs/en/api/errors)).

### Criteria

1. Given a key beginning with an unexpected but non-blank string, connecting stores it and no format rejection appears.
2. Given a key the vendor rejects with 401, verification reports that the key was not accepted, and does not distinguish typo from revoked from expired.
3. Given a key that passes verification, the surface reports that the key authenticates, never that the account can spend.
4. Given verification is unavailable, connecting still succeeds and the row reads unverified rather than broken.
5. No upstream response body reaches an `IpcError.message`; recompose supplies its own wording and may carry the status code alone.

## 2. Masking

**There is no single convention; there are three, and they disagree.** Stripe lists the `sk_test_`/`sk_live_` prefix with the remainder masked and reveal as a deliberate act, and self-created secret keys can never be revealed again ([Stripe](https://docs.stripe.com/keys)). Google Cloud separates `keyString` (the secret, behind Show key), `displayName` (the console Name field), and a key ID that "can't be used to access APIs" ([Creating and managing API keys](https://cloud.google.com/api-keys/docs/create-manage-api-keys), [API Keys overview](https://cloud.google.com/api-keys/docs/overview)). GitHub shows no key material at all in the token list ([Managing personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)).

**The "last four" figure comes from payment cards, not from any key standard.** PCI DSS caps display at the BIN plus the last four digits, and the council states the cap is a ceiling rather than a default ([PCI SSC FAQ](https://www.pcisecuritystandards.org/faq/articles/Frequently_Asked_Question/how-can-an-entity-meet-pci-dss-requirements-for-pan-masking-and-truncation-if-it-has-migrated-to-8-digit-bins/)). No first-party Anthropic or OpenAI statement of console display was reachable.

**The reasoning behind a tail-only mask.** An Anthropic key body runs roughly 95 URL-safe characters after its prefix, so four tail characters carry about 24 bits: no brute-force concern. The exposure is correlation, letting a third party confirm which key leaked or link a screenshot to a key they hold. Publishing the prefix adds nothing, because the row's product title already names the vendor. Four tail characters, no prefix, is the smallest mask that still lets a person match a row to a console entry. This is an architecture decision to record, not a documented rule.

### Criteria

1. The mask is computed in main at connect time and stored on the row as a non-secret field; listing accounts performs no vault read.
2. The account row type carries no `secret` and no `key` property, asserted at the type level; `credentialedAccountSchema` is strict, so the assertion is enforceable.
3. Replacing a key recomputes the mask, because a stale mask beside a new key is a silent lie.
4. The mask derives from the trimmed key, so a pasted newline never becomes part of the displayed tail.
5. Adding the field carries `ACCOUNTS_VERSION` to 3 with a migration.

## 3. Naming, and what duplicate names break

**Consoles split a human display name from the system identifier.** Google Cloud makes it explicit: `displayName` is the console Name field while `name` is the resource path that "isn't displayed in the Google Cloud console" ([Creating and managing API keys](https://cloud.google.com/api-keys/docs/create-manage-api-keys)). Anthropic advises scoping by purpose through workspaces rather than through names ([Authentication](https://platform.claude.com/docs/en/manage-claude/authentication)). No dataset of what people actually type was found.

**LiteLLM documents this failure three times over.** The request: unique non-secret names, because administrators cannot manage keys without seeing their secret values ([litellm#2932](https://github.com/BerriAI/litellm/issues/2932)). Half-enforced uniqueness is its own defect, the UI erroring while the API accepts a duplicate ([litellm#7373](https://github.com/BerriAI/litellm/issues/7373)). Uniqueness scoped too widely is also a defect, one user's alias blocking another's ([litellm#8328](https://github.com/BerriAI/litellm/issues/8328)). Circumstantially, JetBrains worked around GitHub token name collisions with numeric suffixes ([IDEA-198120](https://youtrack.jetbrains.com/issue/IDEA-198120/Cannot-create-github-token-when-one-with-the-name-already-exists)), though GitHub's own docs state no collision rule.

**The failure is not ambiguity in the list, it is ambiguity in the destructive act.** Two rows sharing a name are still told apart by their tails, but a person removing the wrong one loses a vault entry irreversibly, and the key is unrecoverable from the vendor. The repository already refuses a duplicate gateway name with the `name-conflict` code and the wording `Another gateway already holds the name "..."`, and `name-conflict` is already in `ipcErrorSchema`.

### Criteria

1. Connecting a second key with a name the same provider already holds refuses with `name-conflict` and names the holder. Scope the uniqueness to the provider, not to the whole list, because litellm#8328 shows wider scope is itself a defect.
2. Refusal happens before the vault write, so a rejected connect leaves no orphan credential.
3. Surrounding whitespace does not create a distinct name; `label` already trims.
4. Two rows for different providers may share a name, because the row's first line is the product title.

## 4. The seven inert entries, and what each honestly lacks

The row has no place for a base URL, a dialect, or an auth scheme. `credentialedAccountSchema` holds exactly five fields and `connectAccountRequestSchema` takes exactly `provider`, `kind`, `label`, `secret`. Anthropic API and OpenAI API connect because each has one first-party host a hard-coded client can hold.

| Entry           | What it needs that recompose lacks                                                                                                                                                                                                                 | Source                                                                                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gemini API      | A different auth header: native Gemini sends `x-goog-api-key`, neither Bearer nor `x-api-key`. The compatible route needs a base URL plus Bearer and is "still in beta while we extend feature support", silently ignoring unsupported parameters. | [API keys](https://ai.google.dev/gemini-api/docs/api-key), [OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai)                                      |
| Mistral         | A base URL plus request-shape divergences: `random_seed` rather than `seed`, plus `safe_prompt`, `prompt_mode`, `guardrails`.                                                                                                                      | [API reference](https://docs.mistral.ai/api/)                                                                                                                        |
| xAI Grok        | A base URL with Bearer auth, and no first-party claim of Anthropic-dialect compatibility, so the dialect must be recorded rather than assumed.                                                                                                     | [Overview](https://docs.x.ai/docs/overview)                                                                                                                          |
| DeepSeek        | A base URL and a dialect choice, because the vendor publishes both an OpenAI-shaped host and an Anthropic-shaped path.                                                                                                                             | [API docs](https://api-docs.deepseek.com/)                                                                                                                           |
| Moonshot AI     | The same two-surface split, with the Anthropic surface lacking a canonical reference page by the admission of the open request for one.                                                                                                            | [Overview](https://platform.kimi.ai/docs/api/overview), [Kimi-K2#129](https://github.com/MoonshotAI/Kimi-K2/issues/129)                                              |
| Qwen            | A per-workspace, per-region base URL, with keys that differ by region, so a single hard-coded host cannot serve it at all.                                                                                                                         | [Model Studio compatibility](https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope)                                               |
| Custom endpoint | A base URL and a dialect by definition, plus URL-safety rules no schema encodes, and it cannot report a trustworthy verification result because a permissive server may accept any key.                                                            | Local `packages/contracts/src/accounts.ts`; [Open WebUI](https://docs.openwebui.com/getting-started/quick-start/connect-a-provider/starting-with-openai-compatible/) |

Qwen and Gemini are the two whose inertness is unarguable. The five between are gated on the same missing pair of fields.

### Criteria

1. The catalog offers nine entries and exactly two can be picked, matching the shipped requirement that a provider the release can't connect yet stands inert rather than hidden.
2. An inert entry answers neither keyboard nor pointer, and its inertness reads as more than color and position.
3. Picking a connectable entry asks for a name and a key alone: no base URL field, no dialect field.

## 5. Failure reports worth designing against

**Trailing whitespace is a client-side crash, before the request leaves the process.** Node throws `TypeError [ERR_INVALID_CHAR]: Invalid character in header content ["Authorization"]`, and the reported cause is consistently a stray newline in the credential; one reporter states "I had a newline in my PAT token" ([node-slack-sdk#1800](https://github.com/slackapi/node-slack-sdk/issues/1800), also [vscode-restclient#942](https://github.com/Huachao/vscode-restclient/issues/942), [langfuse#8449](https://github.com/langfuse/langfuse/issues/8449)). For recompose the defect is worse, because the bad bytes persist: the secret does not trim, so every later request fails identically with nothing on screen to explain it.

**The wrong vendor's key in the wrong row fails silently.** OpenClaw reports a relay key reaching `api.anthropic.com`, returning 401, after which the "Agent retries 4 times, all fail silently. No error message sent to user", with 13 consecutive silent failures in the log and about an hour lost to diagnosis ([openclaw#23332](https://github.com/openclaw/openclaw/issues/23332)). The reporter calls sending a credential to a host it was not issued for a leak, not merely an auth failure. That argues for naming the host on the connect surface and never silently falling back to a default one. The tempting mitigation, refusing a foreign prefix, is the same mechanism that broke openclaw#72121: a warning is safe, a refusal is not.

**Revocation decays a stored verification result, twice over.** Aikido measured Google API key deletion propagating over nearly 23 minutes at worst, first closed as won't-fix on eventual-consistency grounds then reopened as a P0 ([Aikido](https://www.aikido.dev/blog/google-api-keys-deletion)); OpenAI users report deleted keys still working ([community](https://community.openai.com/t/api-key-deleted-but-still-usable/995249)). A live process can also outlast the key: Codex CLI keeps working after key deletion until the process ends ([openai/codex#15761](https://github.com/openai/codex/issues/15761)). And Anthropic keys can now expire on a schedule the client cannot read, expiring keys answering 401 and never reactivating ([Authentication](https://platform.claude.com/docs/en/manage-claude/authentication)).

The shipped sibling already carries the requirement shape: a lapsed account carries its own way back, on the row rather than as a banner. The one difference is the remedy, because a lapsed key can only be replaced by pasting a new one.

### Criteria

1. A key pasted with surrounding whitespace or a newline stores none of it, and the request that follows does not fail header validation. This needs a change at the contract boundary.
2. A key holding an interior control character refuses with a message about the key's contents rather than throwing later.
3. A key whose shape suggests another vendor may warn and MUST still connect.
4. The connect surface names the host the key will be sent to, and no code path substitutes a different host when the configured one fails.
5. A key revoked at the vendor reports the lapse on its own row and offers a replacement there, never claiming the key is still good on the strength of an earlier check.
6. A verification result is worded as of its last check, never as current standing.
7. Removing a key row deletes its vault entry.

## Where the evidence is thin

1. OpenAI first-party docs were unreachable (403). The prefix inventory and console display are unsourced; `GET /models` is sourced to OpenAI's SDK reference plus a direct 401 observation.
2. No vendor documents a key-validation endpoint. Repurposing token counting and model listing is an inference; Anthropic's "free to use" wording is explicit, nothing equivalent exists for OpenAI.
3. No standard governs mask length for API keys. The four-character figure traces to payment cards, whose guidance calls the maximum a ceiling.
4. Duplicate-name handling has no industry answer, only litellm's cautionary tale in both directions. The gateway `name-conflict` precedent is the tiebreaker.
5. Real key-naming behavior is undocumented: guidance exists, evidence of practice does not.
6. Moonshot's Anthropic-compatible surface has no canonical reference page, by the admission of the open request for one.
