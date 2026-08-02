## Acceptance references: `provider-subscriptions` (tier full)

Discovery arm: acceptance criteria from vendor docs, issue trackers, and community complaints. Every claim below carries a link. Repository paths are relative to the repository root.

---

## 1. The finding that reorders the change

**Anthropic prohibits exactly what this feature proposes for the Claude half, unless recompose is approved in advance.** Two official pages, both fetched 2026-08-01, say so.

Claude Code's [Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance) page, section "Authentication and credential use", verbatim:

> **OAuth authentication** is intended exclusively for purchasers of Claude Free, Pro, Max, Team, and Enterprise subscription plans and is designed to support ordinary use of Claude Code and other native Anthropic applications.
> **Developers** building products or services that interact with Claude's capabilities, including those using the Agent SDK, should use API key authentication through Claude Console or a supported cloud provider. Anthropic does not permit third-party developers to offer Claude.ai login or to route requests through Free, Pro, or Max plan credentials on behalf of their users.
> Anthropic reserves the right to take measures to enforce these restrictions and may do so without prior notice.

The [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview) carries the same rule with the carve-out that matters:

> Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK. Use the API key authentication methods described in the Quickstart instead.

So there is a door: prior approval, routed through [contact sales](https://www.anthropic.com/contact-sales). It is not an engineering decision.

Enforcement is not theoretical. [The Register, 2026-02-20](https://www.theregister.com/2026/02/20/anthropic_clarifies_ban_third_party_claude_access/) reports server-side enforcement from January 2026, account bans, blocking of tools that spoof the Claude Code harness, and OpenCode removing Claude Pro/Max support after legal requests. Anthropic engineer Thariq Shihipar, quoted there: "Third-party harnesses using Claude subscriptions create problems for users and are prohibited by our Terms of Service."

**This directly contradicts a shipped promise.** `README.md` line 31 reads: "sign in with OAuth for Claude and Codex subscriptions, or add any OpenAI-compatible or Anthropic-compatible endpoint with a base URL and key." That sentence needs either an Anthropic approval behind it or a rewrite.

### The conflicting evidence, stated rather than smoothed over

Anthropic's support article [Use the Claude Agent SDK with your Claude plan](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan) describes a monthly Agent SDK credit that explicitly covers "Third-party apps that authenticate with your Claude subscription through the Agent SDK", and [VentureBeat](https://venturebeat.com/technology/anthropic-reinstates-openclaw-and-third-party-agent-usage-on-claude-subscriptions-with-a-catch) reported a reinstatement of third-party agent usage. That change was then paused on 2026-06-15 and programmatic usage went back to drawing on subscription limits as before.

My reading, which a reviewer should challenge: the support article describes billing for _approved_ third parties (OpenClaw was named and reinstated), and the "unless previously approved" clause is the reconciliation. Both prohibition pages are live today and post-date the pause. I am not confident enough to call this settled, and the brainstorm should treat it as an open question with a named owner rather than as a finding.

### Codex: no published prohibition, and no published permission either

- OpenAI's [Codex authentication docs](https://learn.chatgpt.com/docs/auth) document sign in with ChatGPT, `~/.codex/auth.json`, automatic refresh, and a device-code beta. They say nothing about third-party clients.
- An OpenAI maintainer declined to answer the question directly in [openai/codex discussion #8338](https://github.com/openai/codex/discussions/8338) (2025-12-19 and 2026-02-09): the Apache 2.0 licence permits forking, but "I'm an engineer, not a lawyer".
- Credible prior art exists and is still live: [Cline shipped Codex OAuth on 2026-01-22](https://cline.bot/blog/introducing-openai-codex-oauth) with no partnership or approval claim in the post.
- Working against it: [openai/codex #14215](https://github.com/openai/codex/issues/14215) (opened 2026-03-10) shows a third-party client completing `authorize` against `https://auth.openai.com/oauth/authorize` and then getting `403 unsupported_country_region_territory` at `https://auth.openai.com/oauth/token`, from the same machine, network and IP where the official CLI succeeded. No maintainer explanation. Non-official OAuth clients are treated differently at the token endpoint.
- I could not read [openai.com/policies/service-terms](https://openai.com/policies/service-terms/) or the ChatGPT terms of use (both return HTTP 403 to this tool). That is a genuine gap in this brief, and the ToS question for Codex stays unanswered from primary sources.

---

## 2. Acceptance criteria

Each criterion states the observable behaviour and the evidence that it is needed. Grouped so the Gherkin writer can lift them into scenarios.

### A. Policy and disclosure

- **A1.** No Anthropic subscription connect flow ships without a recorded prior approval from Anthropic. ([legal-and-compliance](https://code.claude.com/docs/en/legal-and-compliance), [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview))
- **A2.** A subscription connect screen names whose terms govern the connection and states that the vendor may revoke access without prior notice. The prohibition page says enforcement "may [happen] without prior notice"; the community record shows bans landing with no warning ([OpenAI community, ChatGPT Pro account banned](https://community.openai.com/t/codex-chatgpt-pro-account-banned-with-no-warning-no-explanation-18-month-subscriber/1381906)).
- **A3.** A subscription target is never presented as equal in reliability to an API-key target. Its supply can be withdrawn server-side by the vendor, independently of anything the user did.

### B. The authorization flow

RFC 8252, [OAuth 2.0 for Native Apps](https://datatracker.ietf.org/doc/html/rfc8252), is the binding standard here.

- **B1.** The authorization request opens in the external system browser. Never an embedded `BrowserWindow`. RFC 8252 §5: "native apps MUST use an external user-agent to perform OAuth authorization requests." §8.12: "native apps MUST NOT use embedded user-agents to perform authorization requests."
  This is also the cheaper option in this codebase. `docs/adr/0028-security-baseline.md` locks navigation to the `app://renderer` origin and the dev server, and permits `shell.openExternal` only for `https:`. An `https` authorize URL passes as-is. An embedded window would force a widening of the navigation policy, which ADR-0028 deliberately narrowed.
- **B2.** PKCE with `code_challenge_method=S256` on every authorization request. RFC 8252 §6: "Public native app clients MUST implement the Proof Key for Code Exchange (PKCE) extension to OAuth."
- **B3.** A high-entropy `state` value per attempt, and any callback whose `state` does not match a pending request is rejected without a token exchange. RFC 8252 §8.9.
- **B4.** The loopback listener binds `127.0.0.1` and `[::1]`, not the hostname `localhost`, and not `0.0.0.0`. RFC 8252 §7.3 fixes the two literal forms. [antigravity-claude-proxy #176](https://github.com/badrisnarayanan/antigravity-claude-proxy/issues/176) (2026-01-22) shows the `0.0.0.0` bind causing `listen EACCES: permission denied 0.0.0.0:51121` on Windows.
- **B5.** A bind failure is reported as a bind failure, naming the port and the likely cause, never as a generic login failure. Windows reserves TCP ranges when WSL2, Docker Desktop, or Hyper-V is present, and the port looks free to `netstat`; the diagnostic is `netsh interface ipv4 show excludedportrange protocol=tcp` (same issue). Claude Code has its own version of this: [anthropics/claude-code #27408](https://github.com/anthropics/claude-code/issues/27408), "Failed to start OAuth callback server: Failed to start server. Is port 0 in use?"
- **B6.** Where the vendor pins the redirect port, the app cannot choose one. Codex hardcodes `http://localhost:1455/auth/callback` ([openai/codex #12263](https://github.com/openai/codex/issues/12263), opened 2026-02-19). That issue records the consequences: a second instance already holding the port produces a 400 state mismatch, because the listener answering belongs to a different instance than the one that generated the state. Criterion: detect an in-use pinned port and refuse with an explanatory message, rather than exchanging a code against a foreign listener.
- **B7.** A manual code-paste fallback exists for the case where the browser cannot reach the local listener. Both vendors ship one: Claude Code prints "Paste code here if prompted" and calls out WSL2, SSH and containers ([Authentication](https://code.claude.com/docs/en/authentication)); Codex offers a device-code beta ([Codex auth](https://learn.chatgpt.com/docs/auth)).
- **B8.** The callback listener serves exactly one request, then closes, and it times out if no callback arrives.

### C. Token lifecycle, where nearly every reported failure lives

- **C1.** Refresh happens proactively before expiry and reactively on a 401. Anthropic's access token carries `expires_in: 28800` (8 hours); refresh is `POST https://platform.claude.com/v1/oauth/token` with `grant_type=refresh_token` and `client_id` ([anthropics/claude-code #53063](https://github.com/anthropics/claude-code/issues/53063), CLI 2.1.104). Codex's own CI/CD guidance describes both halves: refresh when `last_refresh` is older than about 8 days, plus "if a request gets a `401`, Codex also has a built-in refresh-and-retry path" ([CI/CD auth](https://learn.chatgpt.com/docs/auth/ci-cd-auth)).
- **C2.** Refresh tokens rotate and are single use. Reusing one is fatal to the session. [openai/codex #19803](https://github.com/openai/codex/issues/19803) (opened 2026-04-27) records the exact error: `refresh_token_reused`, "Your refresh token has already been used to generate a new access token. Please try signing in again", followed by `401 token_invalidated`.
- **C3.** Refresh is single-flight per account. [anthropics/claude-code #54443](https://github.com/anthropics/claude-code/issues/54443) (CC 2.1.121) shows two processes sharing one credential store: one rotates, the other's stale refresh returns HTTP 400, and 401s cascade across every session roughly a minute later. No serialisation exists across processes there. Note this repository already owns the primitive: `oneAtATime` in `apps/desktop/src/main/storage/one-at-a-time.ts`, used through `inVaultOrder`.
- **C4.** A 401 is authoritative even when the locally stored expiry says the token is still good. Same issue: refreshed at 16:59:24Z, local expiry 00:59:24Z, first 401 at 19:58:52Z, about five hours early. A client that trusts its own clock loops.
- **C5.** A rotated refresh token is written back durably before the new access token is used. [cc-switch #4474](https://github.com/farion1231/cc-switch/issues/4474) reports rotation that never syncs back to storage, producing a false "session expired" on the next start.
- **C6.** A failed refresh leaves the stored credential intact. [anthropics/claude-code #61912](https://github.com/anthropics/claude-code/issues/61912) describes a transient upstream 5xx during refresh corrupting the credential state into a persistent 401 loop that survives restarts. Write the new bundle atomically or keep the old one.
- **C7.** recompose holds its own grant and never reads or writes the vendor CLI's credential store. Sibling clients on one machine invalidate each other through rotation ([openai/codex #19803](https://github.com/openai/codex/issues/19803), and OpenAI's own CI/CD page states the constraint plainly: "Only one machine uses each `auth.json` copy"). Copying tokens out of `~/.claude/.credentials.json`, the macOS Keychain, or `~/.codex/auth.json` makes recompose the process that logs the user out of their editor.
- **C8.** A login has a hard lifetime beyond what refresh extends, and the account row warns ahead of it. Claude Code shows "Your login expires in 3 days · run /login to renew" and then a distinct terminal state, `Login expired · Please run /login`, surfaced in `/status` as "Expired — log in again" ([Authentication](https://code.claude.com/docs/en/authentication)).

### D. Storage, against the shape this repository already has

- **D1.** A subscription credential is a bundle, not a string: access token, refresh token, absolute expiry, token type, granted scope, and the vendor account identifier. Today `packages/contracts/src/ipc.ts` defines `connectAccountRequestSchema` with a single `secret: nonBlankString`, and `apps/desktop/src/main/ipc/storage-ipc.ts` writes exactly one vault entry per account. That shape cannot carry a rotating bundle.
- **D2.** There must be a rotate path. The IPC surface in `packages/contracts/src/ipc.ts` offers only `accounts:list`, `accounts:connect` and `accounts:remove`. Nothing updates a stored secret in place, so C5 has nowhere to land.
- **D3.** Auth failure needs a typed code. `ipcErrorSchema` in `packages/contracts/src/ipc.ts` enumerates `vault-unavailable`, `vault-newer-schema`, `settings-newer-schema`, `validation-failed`, `storage-failed`, `folder-open-failed`, `name-conflict`, `port-conflict`. There is no code for an expired login, a rotated-elsewhere refresh token, or a revoked grant. `.claude/rules/clean-code.md` requires expected failures to be modelled as typed results, and these three are the routing-relevant ones.
- **D4.** Refresh runs in the main process, not the engine. `docs/adr/0016-storage-architecture.md` fixes this: main is the single writer of the vault, and "the engine never writes a secret to disk", receiving secrets in memory at spawn and on change. A token the engine refreshes has no way to persist, so the refreshed bundle must originate in main and be pushed down.
- **D5.** Encryption-at-rest behaviour follows the existing precedent in `docs/adr/0047-gateway-token-vault-and-clipboard.md` and `docs/adr/0016-storage-architecture.md`: `safeStorage`, a visible `plaintext-fallback` warning on Linux backends that degrade, and no mint or write where encryption is unavailable.
- **D6.** Removing an account clears the stored bundle and, where the vendor offers revocation, revokes it. `removeAccount` in `apps/desktop/src/main/ipc/storage-ipc.ts` already deletes the vault entry; revocation is the new part.

`packages/contracts/src/accounts.ts` already carries `accountKindSchema = z.enum(['subscription', 'api-key', 'aggregator'])`, so the slot exists. The row itself carries no expiry, no refresh reference and no vendor account id.

### E. Request shape, if any subscription path ships

- **E1.** Vendor beta headers are unstable and rejected loudly when wrong. [anthropics/claude-code #13770](https://github.com/anthropics/claude-code/issues/13770) records the exact 400: "Unexpected value(s) `oauth-2025-04-20` for the `anthropic-beta` header. Please consult our documentation at docs.anthropic.com or try again without the header." Introduced in CC 2.0.65, breaking gateway paths that had worked in 2.0.64. A gateway that forwards or injects these must be able to change them without a release.
- **E2.** Do not build on harness impersonation. The documented working recipe for subscription tokens is a `Bearer` token plus `anthropic-beta: claude-code-20250219,oauth-2025-04-20`, a `claude-cli` user agent, and a mandatory first system block reading "You are Claude Code, Anthropic's official CLI for Claude." ([promptfoo Anthropic provider docs](https://www.promptfoo.dev/docs/providers/anthropic/)). Spoofing the Claude Code harness is named in The Register piece as the specific thing Anthropic blocks server-side. Treat this recipe as evidence of what breaks, not as a design.
- **E3.** The Codex subscription path is an undocumented backend endpoint, reported as `POST chatgpt.com/backend-api/codex/responses` with the `Authorization` bearer and `ChatGPT-Account-ID` forwarded. My sources for the exact path are secondary ([Codex Knowledge Base](https://codex.danielvaughan.com/2026/04/24/codex-subscription-api-programmatic-access-gpt-5-5-chatgpt-plan/)), not OpenAI documentation, so treat the path as unverified. The load-bearing point is verified by absence: it appears in no official reference, so it carries no stability guarantee.

### F. Quota and failure surfacing, where a gateway earns its keep

- **F1.** A subscription budget is not owned by recompose. Anthropic's own support article states limits are "shared across Claude and Claude Code, meaning all activity in both tools counts against the same usage limits" ([Use Claude Code with your Pro or Max plan](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan)). Codex is capped by a 5-hour rolling window plus a stacked weekly cap. A router must treat remaining quota as observed, never as computed.
- **F2.** A 429 marks the target unavailable until its reset time and hands traffic to the next rung of the failover ladder. It must never become a retry loop against the same target. `retry-after` and the `anthropic-ratelimit-*-reset` headers (RFC 3339) are the documented signals ([Rate limits](https://platform.claude.com/docs/en/api/rate-limits)).
- **F3.** The `anthropic-ratelimit-unified-5h-*` and `-7d-*` headers reported in community issues do **not** appear on the official [Rate limits](https://platform.claude.com/docs/en/api/rate-limits) page, which lists only the per-organization request and token headers. Any parsing of unified headers is defensive parsing of an undocumented surface: absent means absent, never zero.
- **F4.** Four failure states stay distinguishable to the user: login expired, refresh token rotated elsewhere, quota exhausted until a stated time, and provider unreachable. The community record is a catalogue of tools that collapse them. [openai/codex #19803](https://github.com/openai/codex/issues/19803) is an infinite spinner with no error. [anthropics/claude-code #53063](https://github.com/anthropics/claude-code/issues/53063) exits `rc=1` with empty stderr, the 401 visible only inside the session JSONL file. `.claude/rules/clean-code.md` forbids exactly this ("no silent failures", "fail with context").
- **F5.** A subscription account that cannot refresh surfaces on the account row and on any gateway that routes to it, before a client request fails. Claude Code added `/status` reporting for precisely this reason, in v2.1.210.

### G. Multiple accounts

- **G1.** Two subscription accounts on the same provider are distinguishable by label and each carries its own credential reference. `packages/contracts/src/accounts.ts` already mints one `credentialRef` per row and refuses duplicate ids, so this holds today.

---

## 3. Trade-offs

**Anthropic subscription OAuth.** Upside: it is the thing users ask for, and it is the headline in `README.md`. Downside: prohibited without prior approval, enforced server-side without notice, and the failure mode lands on the user's account rather than on recompose. Building it and shipping it unapproved risks users' Max subscriptions, not just a feature.

**Codex/ChatGPT subscription OAuth.** Upside: no published prohibition, live prior art in Cline since 2026-01-22, and OpenAI documents a supported refresh path. Downside: an undocumented inference endpoint, a hardcoded callback port that collides, a token endpoint that treats non-official clients differently ([#14215](https://github.com/openai/codex/issues/14215)), OpenAI's own "only one machine uses each `auth.json` copy" constraint, and community reports of account bans. The evidence for permission is silence, which is not permission.

**Delegating to the vendor's own binary instead of holding tokens.** Spawning `claude -p` or `codex` as a subprocess avoids the token lifecycle entirely. Anthropic's Agent SDK note closes this too: the approval requirement covers "agents built on the Claude Agent SDK", and the CLI is the same credential. It also collides with `docs/adr/0002-engine-in-electron-utilityprocess.md`'s premise that the engine is a pure TypeScript package. Worth a line in the brainstorm, not a recommendation.

**API keys only.** Upside: sanctioned by both vendors, already the codebase's shape (`kind: 'api-key'`, one opaque secret, no rotation), and it needs none of section C. Downside: it does not deliver the feature as named, and users pay per token rather than from a subscription they already own.

---

## 4. Recommendation

1. **Split the change before the brainstorm.** The subscription lifecycle work (sections C and D) is real, useful, and vendor-neutral. The Claude connect flow is a policy decision that no amount of engineering resolves.
2. **Open an approval request with Anthropic now**, through the [contact sales](https://www.anthropic.com/contact-sales) route the Agent SDK note points at. The "unless previously approved" clause is the only path that makes the `README.md` promise true. Until it returns, the Anthropic subscription target should not ship, and `README.md` line 31 should be corrected rather than left as a promise the product cannot keep.
3. **Put the Codex decision in front of the maintainer with the risk stated**, not to an engineering default. The honest summary is: no published prohibition, credible prior art, undocumented transport, and a documented single-machine constraint that recompose would violate the moment a user runs both recompose and Codex CLI.
4. **Whatever ships, land the lifecycle contract first**, because none of it exists: a token bundle in place of a single `secret`, an `accounts:update` (or rotate) channel, typed auth-failure codes in `ipcErrorSchema`, single-flight refresh in main, and durable write-back before use. Criteria C1 through C8 and D1 through D6 are the acceptance set for that contract, and they are provable without any subscription connected, using a fake authorization server at a loopback address.

---

## 5. Where the evidence is thin, and what I could not verify

- **The Anthropic policy conflict (section 1) is unresolved.** Two official prohibitions against one official support article describing third-party subscription auth as a billed category. My reconciliation via "unless previously approved" is a reading, not a citation.
- **OpenAI's terms could not be read.** `openai.com/policies/terms-of-use` and `openai.com/policies/service-terms` both returned HTTP 403 to this tool. The Codex ToS question has no primary-source answer in this brief.
- **The `anthropic-ratelimit-unified-*` header names** come from community issue titles, not from Anthropic documentation. Do not treat the exact names as verified.
- **The Codex subscription endpoint path** (`chatgpt.com/backend-api/codex/responses`) comes from a third-party blog, not OpenAI.
- **Issues I fetched and read directly:** anthropics/claude-code #53063, #54443, #13770; openai/codex #19803, #14215, #12263; badrisnarayanan/antigravity-claude-proxy #176. **Issues I cite from search summaries only, unread:** anthropics/claude-code #61912 and #27408, farion1231/cc-switch #4474. Weight them accordingly.
- **Claude Code's own OAuth redirect port and scopes** I deliberately did not assert. The search results mixed Claude Code's login flow with Claude's MCP connector OAuth, and I could not separate them from a primary source.

---

### Sources

- [Claude Code, Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance) (fetched 2026-08-01)
- [Claude Code, Authentication](https://code.claude.com/docs/en/authentication) (fetched 2026-08-01)
- [Claude Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview) (fetched 2026-08-01)
- [Use the Claude Agent SDK with your Claude plan](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)
- [Use Claude Code with your Pro or Max plan](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan)
- [Claude Platform, Rate limits](https://platform.claude.com/docs/en/api/rate-limits)
- [Codex, Authentication](https://learn.chatgpt.com/docs/auth)
- [Codex, Maintain account auth in CI/CD](https://learn.chatgpt.com/docs/auth/ci-cd-auth)
- [RFC 8252, OAuth 2.0 for Native Apps](https://datatracker.ietf.org/doc/html/rfc8252)
- [The Register, Anthropic clarifies ban on third-party tool access to Claude, 2026-02-20](https://www.theregister.com/2026/02/20/anthropic_clarifies_ban_third_party_claude_access/)
- [VentureBeat, Anthropic reinstates OpenClaw and third-party agent usage on Claude subscriptions](https://venturebeat.com/technology/anthropic-reinstates-openclaw-and-third-party-agent-usage-on-claude-subscriptions-with-a-catch)
- [anthropics/claude-code #53063, OAuth auto-refresh fails in non-interactive mode](https://github.com/anthropics/claude-code/issues/53063)
- [anthropics/claude-code #54443, refresh returns 400 after early 401; concurrent sessions forced to /login](https://github.com/anthropics/claude-code/issues/54443)
- [anthropics/claude-code #13770, anthropic-beta rejects oauth-2025-04-20 with 400](https://github.com/anthropics/claude-code/issues/13770)
- [anthropics/claude-code #61912, OAuth refresh corrupts credentials during transient 5xx](https://github.com/anthropics/claude-code/issues/61912)
- [anthropics/claude-code #27408, Failed to start OAuth callback server](https://github.com/anthropics/claude-code/issues/27408)
- [openai/codex #19803, refresh_token_reused causes auth loop](https://github.com/openai/codex/issues/19803)
- [openai/codex #14215, third-party ChatGPT OAuth client gets 403 at the token endpoint](https://github.com/openai/codex/issues/14215)
- [openai/codex #12263, add Sign in with Device Code for localhost:1455 callback issues](https://github.com/openai/codex/issues/12263)
- [openai/codex discussion #8338, does forking Codex CLI affect ToS with Sign in with ChatGPT](https://github.com/openai/codex/discussions/8338)
- [farion1231/cc-switch #4474, Codex OAuth rotation does not sync back](https://github.com/farion1231/cc-switch/issues/4474)
- [badrisnarayanan/antigravity-claude-proxy #176, Windows excluded TCP port range and EACCES](https://github.com/badrisnarayanan/antigravity-claude-proxy/issues/176)
- [Cline, Bring your ChatGPT subscription to Cline, 2026-01-22](https://cline.bot/blog/introducing-openai-codex-oauth)
- [promptfoo, Anthropic provider docs](https://www.promptfoo.dev/docs/providers/anthropic/)
- [OpenAI community, Codex + ChatGPT Pro account banned with no warning](https://community.openai.com/t/codex-chatgpt-pro-account-banned-with-no-warning-no-explanation-18-month-subscriber/1381906)
- [Codex Knowledge Base, The Codex Subscription API (secondary, unverified endpoint claim)](https://codex.danielvaughan.com/2026/04/24/codex-subscription-api-programmatic-access-gpt-5-5-chatgpt-plan/)

### Repository references

- `README.md` (line 31, the subscription OAuth promise)
- `packages/contracts/src/accounts.ts` (`accountKindSchema` already carries `'subscription'`; the row carries no expiry or refresh fields)
- `packages/contracts/src/ipc.ts` (`connectAccountRequestSchema` single `secret`; no rotate channel; `ipcErrorSchema` has no auth failure code)
- `apps/desktop/src/main/ipc/storage-ipc.ts` (`connectAccount` and `removeAccount`, one vault entry per account, no update path)
- `apps/desktop/src/main/ipc/storage-context.ts` (`StoragePaths`, `openVaultForWrite`, the encryption-availability guard)
- `apps/desktop/src/main/storage/one-at-a-time.ts` (the existing serialisation primitive, reachable for single-flight refresh)
- `packages/contracts/src/gateway-config.ts` (`targetSchema.accountId`, the failover and round-robin router modes a 429 must feed)
- `docs/adr/0016-storage-architecture.md` (single-writer vault in main, engine never persists a secret)
- `docs/adr/0028-security-baseline.md` (navigation policy, `https`-only `shell.openExternal`, deny-by-default permissions)
- `docs/adr/0047-gateway-token-vault-and-clipboard.md` (the precedent for secret handling and plaintext-fallback reporting)
- `.claude/rules/clean-code.md` (typed expected failures, no silent failures)
