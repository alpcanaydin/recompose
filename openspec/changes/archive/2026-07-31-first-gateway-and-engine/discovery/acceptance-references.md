## Acceptance-references brief: `first-gateway-and-engine` (tier full)

Scope read from `openspec/changes/first-gateway-and-engine/proposal.md`, `openspec/changes/first-gateway-and-engine/specs/gateways/spec.md`, and `openspec/changes/first-gateway-and-engine/specs/engine/spec.md`. Every criterion below is either backed by an external source or by a file already in this repository. Where evidence is thin I say so.

---

## 1. Bind address: loopback-only is not one address

**Finding.** Node's `server.listen()` with the host omitted binds the unspecified address, and Node's own docs warn that binding `::` commonly also binds `0.0.0.0`. That would expose paid accounts on the LAN, which the engine spec explicitly forbids. ([Node `net` docs](https://nodejs.org/api/net.html#serverlisten))

**Finding.** Binding only `127.0.0.1` is not sufficient for a client that points at `http://localhost:PORT`. Since v17.0.0 Node's default DNS result order is `verbatim`, so `localhost` resolves in OS order and can yield `::1` first. ([Node `dns.setDefaultResultOrder` docs](https://nodejs.org/api/dns.html#dnssetdefaultresultorderorder)) The concrete failure is `connect ECONNREFUSED ::1:<port>` against a server listening only on IPv4 loopback; Node has shipped a confirmed bug where `dns.lookup('localhost', {all: true})` returned only `::1` ([nodejs/node#56137, filed 2024-12-05](https://github.com/nodejs/node/issues/56137)), and the same class of breakage is widely reported for Node 17 and 18 ([write-up, 2023-07-28](https://serebrov.github.io/html/2023-07-28-node-econnrefused-localhost.html)).

**Finding.** Both loopback addresses are firewall-safe on macOS. Tom Lane, pgsql-hackers, 2018-07-26: "Binding to 127.0.0.1 does not trigger the firewall popup. Binding to ::1 doesn't, either. But binding to fe80::1 does." ([postgresql.org message](https://www.postgresql.org/message-id/18689.1532641517%40sss.pgh.pa.us)) Caveat: 2018 evidence, macOS behavior may have shifted; treat as directional, verify on the target OS matrix.

**Acceptance criteria**

- AC-1: The engine listens on both `127.0.0.1` and `::1` at the stored port, and on neither `0.0.0.0` nor `::`. A test asserts a successful request to `http://127.0.0.1:PORT/...` and to `http://[::1]:PORT/...`, and asserts that a bind to a non-loopback local interface address is refused or never attempted.
- AC-2: `server.listen()` is never called without an explicit host.
- AC-3 (design note, not yet in the delta): one `http.Server` can bind once. Serving both loopback families means two server instances sharing one request handler, and "the engine reports running" only once both are listening. The spec's "one server listens" wording in `specs/engine/spec.md` needs rewording to "one request handler", or the IPv6 case has to be an accepted, recorded gap.

---

## 2. Failing to bind, and the state the UI has no name for

**Finding.** `server.listen()` does not throw on a port conflict; it emits `'error'` on the server, and an unhandled `'error'` event becomes an uncaught exception. Node's docs carry the `EADDRINUSE` example directly. ([Node `net` docs, `'error'` event](https://nodejs.org/api/net.html#event-error_1)) Node also throws `ERR_SERVER_ALREADY_LISTEN` if `listen()` is called again without a preceding error or `close()`.

**Finding, from complaints.** The failure users actually report is a silent one: "the new GUI instance then spawns a fresh server that fails silently because the port is already taken", plus orphaned sockets after an unclean exit. ([LM Studio port-conflict write-up](https://markaicode.com/errors/lm-studio-port-conflict-fix/)) On macOS specifically, ports 5000 and 7000 are held by ControlCenter for AirPlay Receiver, which is why Flask moved its macOS default to 5001. ([replicate/cog#1099](https://github.com/replicate/cog/issues/1099), [Apple Developer Forums thread 682332](https://developer.apple.com/forums/thread/682332)) The engine default of `8397` in `packages/contracts/src/settings.ts` avoids this, but the port is user-editable across the full 1024-65535 range.

**Acceptance criteria**

- AC-4: An `'error'` listener is attached before `listen()` resolves. `EADDRINUSE` produces a typed failure naming the port, never an uncaught exception and never a silent no-op.
- AC-5: A failed start leaves the engine in a state a second start attempt can recover from, that is, `listen()` is retried only after `close()` or an error, never against an already-listening server.
- AC-6 (**gap**): `specs/engine/spec.md` requires the engine to report "that it failed to start", but `specs/gateways/spec.md` says the status dot "MUST distinguish running from stopped". There is no UI state for failed. Either the dot gets a third state or the delta names the surface that carries the failure. As written the two capability specs contradict each other.

---

## 3. Stopping, and starting again on the same port

**Finding.** `server.close()` "stops the server from accepting new connections and closes all connections ... which are not sending a request or waiting for a response". Since Node v19.0.0 it closes idle connections before returning, so `closeIdleConnections()` is no longer needed alongside it. `closeAllConnections()` (v18.2.0) is the forceful option and the docs recommend calling it _after_ `server.close()` to avoid a race where new connections arrive in between. ([Node `http` docs](https://nodejs.org/api/http.html#serverclosecallback))

**Acceptance criteria**

- AC-7: Stop resolves only once the listener is actually closed, and a start immediately afterward on the same port succeeds without `EADDRINUSE`.
- AC-8: An in-flight request at stop time does not hang the stop indefinitely. Given the engine will later stream SSE for minutes ([Anthropic documents a 10-minute non-streaming ceiling](https://platform.claude.com/docs/en/api/errors)), decide now whether stop drains or force-closes, and encode that choice as a scenario.

---

## 4. Base URL shape: the preview string is load-bearing

This is the highest-value finding for the creation sheet, because the sheet's preview is what a person will paste into a client.

**Finding.** The two dialects the gateway serves (per `docs/adr/0005-single-port-path-per-gateway.md`) disagree about whether `/v1` belongs in the base URL.

- Anthropic's own SDK and Claude Code take a base URL _without_ the version and append `/v1/messages`.
- The OpenAI SDKs take a base URL _with_ `/v1` and append `/chat/completions`. Every local OpenAI-compatible server documents it that way: Ollama `http://localhost:11434/v1` ([Ollama OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility)), LM Studio `http://localhost:1234/v1` ([LM Studio](https://lmstudio.ai/docs/developer/openai-compat)).
- The conflict is documented in the wild: `@ai-sdk/anthropic` expects `/v1` in `ANTHROPIC_BASE_URL` while the official Anthropic SDK expects it absent, and the mismatch produces either `/messages` (404) or `/v1/v1/messages`. ([vercel/ai#15542, opened 2026-05-22](https://github.com/vercel/ai/issues/15542))

**Finding.** Naive client-side concatenation is the norm, not the exception, and it produces exactly two malformed shapes: a doubled `/v1` and a doubled slash.

- `OPENAI_BASE_URL=https://api.deepseek.com/v1` yields `.../v1/v1/chat/completions` and a silent 404. ([rohitg00/agentmemory#628](https://github.com/rohitg00/agentmemory/issues/628))
- A trailing slash yields `https://openrouter.ai/api/v1//chat/completions`. ([BerriAI/litellm#8350](https://github.com/BerriAI/litellm/issues/8350))
- Same class of bug in the OpenAI Go SDK ([openai/openai-go#160](https://github.com/openai/openai-go/issues/160)), the OpenAI Python SDK ([openai/openai-python#1373](https://github.com/openai/openai-python/issues/1373)), and aichat ([sigoden/aichat#767](https://github.com/sigoden/aichat/issues/767)).

**Finding.** Path-prefix routing is a documented incident class on its own. LiteLLM lost prefix routing for four days (2026-01-22 to 2026-01-26) when one PR dropped `root_path`, and their remedy was a CI job that boots the app under a prefix such as `/api/v1` and asserts reachability. ([LiteLLM incident report](https://docs.litellm.ai/blog/server-root-path-incident))

**Acceptance criteria**

- AC-9: The engine routes `/{slug}/v1/messages`, `/{slug}/v1/chat/completions`, `/{slug}//v1/...` (doubled slash), and `/{slug}/v1/v1/...` (doubled version) to the same handler rather than answering 404. Normalize empty path segments and a repeated leading `v1` before matching.
- AC-10: The engine treats `/{slug}` and `/{slug}/` as the same gateway, and never answers a redirect on a POST. A 301 or 302 can drop the body or downgrade the method at the client.
- AC-11 (**gap**): the sheet's preview of `http://localhost:PORT/SLUG` is correct for Anthropic clients and wrong for OpenAI clients, which need `http://localhost:PORT/SLUG/v1`. Recommendation: show both labelled lines, or show the bare base and let AC-9 absorb the difference. Decide it here rather than in a support thread.
- AC-12: A prefix-routing regression test exists at the same level LiteLLM added one, that is, an end-to-end request through the real listener under a slug prefix, not a unit test of the matcher alone.

---

## 5. The typed refusal: two envelopes, not one

**Finding.** The two dialects have different error envelopes, and both are documented.

- Anthropic: `{"type": "error", "error": {"type": "not_found_error", "message": "..."}, "request_id": "req_..."}`, with 404 mapping to `not_found_error` and 400 to `invalid_request_error`. Errors are "always" JSON. ([Anthropic error docs](https://platform.claude.com/docs/en/api/errors))
- OpenAI: `{"error": {"message": ..., "type": ..., "param": ..., "code": ...}}`, with a missing model surfacing as `type: invalid_request_error`, `code: model_not_found`, status 404. The official error-code page documents statuses but omits the 404 row, so the envelope shape comes from the SDK and community reports rather than a single canonical page. ([OpenAI error codes](https://developers.openai.com/api/docs/guides/error-codes), [community thread](https://community.openai.com/t/api-returning-404-model-not-found-all-of-a-sudden-why-and-how-to-fix/679777))

**Finding.** Status choice drives client retry behavior, so it is not cosmetic. openai-node retries connection errors, 408, 409, 429, and >=500 twice by default and does **not** retry 404. ([openai-node README](https://github.com/openai/openai-node)) Anthropic's SDKs likewise retry transient failures twice by default. ([Anthropic error docs](https://platform.claude.com/docs/en/api/errors)) A gateway that answers 503 for "no model configured" therefore gets silently retried three times for a permanent misconfiguration.

**Finding.** SDKs map status to typed exceptions (400 `BadRequestError`, 401 `AuthenticationError`, 404 `NotFoundError`, 429 `RateLimitError`, >=500 `InternalServerError`), so a non-JSON or HTML body is a client-side parse problem, not a readable error. ([openai-node README](https://github.com/openai/openai-node))

**Acceptance criteria**

- AC-13: The refusal for a gateway carrying no virtual model answers HTTP 404, never 5xx, so no SDK retries it.
- AC-14: The refusal body is dialect-correct. A request to `/{slug}/v1/messages` gets the Anthropic envelope; a request to `/{slug}/v1/chat/completions` gets the OpenAI envelope. The spec's "a shape a client can read" is under-specified as written and should name both.
- AC-15: `Content-Type: application/json` on every refusal, including the unknown-slug refusal. No HTML, no bare text.
- AC-16: The unknown-slug refusal also carries a dialect-appropriate JSON envelope when the path looks like an API call, and a plain JSON 404 otherwise.
- AC-17 (thin evidence, flagged): several clients populate a model picker from `GET /v1/models` and behave badly when it 404s ([cline/cline#8030](https://github.com/cline/cline/issues/8030), [Cline OpenAI-compatible docs](https://docs.cline.bot/provider-config/openai-compatible)). A gateway with zero virtual models arguably should answer `{"object":"list","data":[]}` rather than 404. I could not find an authoritative statement that any client _requires_ it, so treat this as a candidate, not a finding.

---

## 6. Security: a loopback bind is not access control

**Finding.** CVE-2024-28224 is exactly this shape: Ollama's loopback API had no Host header validation and no auth, so a malicious web page could reach it via DNS rebinding and exfiltrate data, "in as little as 3 seconds". NCC Group's remedy is explicit: "For services listening on the loopback interface, this set of whitelisted host values should only contain `localhost`, and all reserved numeric addresses for the loopback interface, including `127.0.0.1`." Fixed in Ollama v0.1.29. ([NCC Group advisory, 2024-04-08](https://www.nccgroup.com/research-blog/technical-advisory-ollama-dns-rebinding-attack-cve-2024-28224/))

**Repository reference.** `docs/adr/0047-gateway-token-vault-and-clipboard.md` already states the threat in the project's own words: "recompose fronts paid accounts, so a gateway serving a local network without one hands the quota to whoever asks." The `requireGatewayToken` switch and the minted token already exist in `packages/contracts/src/settings.ts` and in the vault. Neither spec delta mentions the engine reading either one.

**Acceptance criteria**

- AC-18: The engine rejects any request whose `Host` header is not in `{localhost:PORT, 127.0.0.1:PORT, [::1]:PORT}`. This is the direct CVE-2024-28224 mitigation and it costs one comparison.
- AC-19 (**gap**): the delta must say what the engine does when `requireGatewayToken` is true. Shipping an engine that ignores the switch makes a security control that is on in settings and off in reality. If enforcement is deferred, record it as a named deferral rather than an omission.
- AC-20: The health path stays unauthenticated even when the token is required, matching the split LiteLLM uses (`/health/liveliness` unauthenticated, `/health` authenticated). ([LiteLLM health docs](https://docs.litellm.ai/docs/proxy/health))

---

## 7. Health path

**Finding.** LiteLLM separates a cheap unauthenticated liveness probe returning a fixed body from an authenticated deep check that actually calls the configured models. ([LiteLLM health docs](https://docs.litellm.ai/docs/proxy/health)) Kubernetes chose the `z` suffix precisely because "these words would not be used normally, so routes using these words would likely not collide with existing routes", and machine checks are told to rely on the HTTP status code rather than the body. ([Kubernetes API health checks](https://www.kubernetes.io/docs/reference/using-api/health-checks/))

**Acceptance criteria**

- AC-21: `GET /{slug}/health` answers 200 with a JSON body naming the slug. The spec's "answers with a success carrying that gateway's slug" is satisfiable by body alone; add the status code to the scenario so a machine check has something to read.
- AC-22: The health path is reachable while zero virtual models exist, which is the whole point of the requirement.

---

## 8. Slugs: format is not the only constraint

**Repository finding, defect-level.** `apps/desktop/src/main/storage/gateway-store.ts` writes `${config.slug}.json` and has no uniqueness check anywhere on the path. `apps/desktop/src/main/ipc/storage-ipc.ts` calls `saveGatewayConfig` directly. Saving a gateway whose slug matches an existing one therefore **silently overwrites the existing gateway's file today**. `specs/gateways/spec.md` requires the sheet to keep itself open and name the conflict, so this needs an enforcement point in main, not only a renderer-side check against a possibly stale list.

**Repository finding.** `packages/contracts/src/ipc.ts` has a closed `ipcErrorSchema` code set with no member for a slug conflict. Returning a typed conflict needs a new code, which `docs/adr/0018-typed-ipc-with-result-envelope.md` treats as a deliberate, reviewable act.

**Repository finding.** `docs/adr/0005-single-port-path-per-gateway.md` already names the reserved-name problem in its Consequences: "Path routing must reserve gateway names that collide with API paths (`v1`, etc.)." The regex in `packages/contracts/src/gateway-config.ts` accepts `v1` and `health` today, and imposes no maximum length.

**Acceptance criteria**

- AC-23: Saving a gateway whose slug an existing gateway holds fails with a typed conflict and writes nothing. A regression test asserts the existing file is unchanged.
- AC-24: `v1` and `health` are rejected at save time as reserved slugs, with the reserved list living beside the router that consumes it so the two cannot drift.
- AC-25: The slug carries a maximum length. It becomes a filename, and no bound exists today.
- AC-26: The conflict check runs in main, not only in the renderer, because the renderer's list can be stale.

---

## 9. Lifecycle reporting across the process boundary

**Repository finding.** `docs/adr/0018-typed-ipc-with-result-envelope.md` records under Consequences: "Push-style updates remain unsolved until the engine lands." `packages/contracts/src/ipc.ts` is invoke-only (`RecomposeIpc` maps each channel to `(request) => Promise<response>`), so the engine cannot push running or stopped to the screen through the existing surface. Three channels do not exist yet either: start, stop, and status.

**Acceptance criteria**

- AC-27: The change adds the engine channels to `packages/contracts/src/ipc.ts` and a push mechanism for lifecycle state, and records the push design as a decision, since ADR-0018 explicitly left it open.
- AC-28 (**gap**): what happens when a person saves a new gateway while the engine is running? The sidebar dot reports per-gateway running or stopped, which implies the new gateway serves without a restart. Neither spec says so. Add the scenario.
- AC-29 (**gap**): what happens when a person changes `enginePort` while the engine is running? Neither spec says. LM Studio's prior art is an explicit Apply that restarts the listener ([LM Studio port docs](https://markaicode.com/errors/lm-studio-port-conflict-fix/)). Either restart on change or state plainly on the settings screen that the change takes effect at next start.
- AC-30: Start called twice, and stop called while stopped, are both idempotent rather than error paths.

---

## 10. Packaging and boundary constraints already encoded in the repo

**Repository finding.** `.dependency-cruiser.cjs` carries `desktop-not-into-engine` (severity error): `apps/desktop/**` may not depend on `packages/engine/**` at all. The main process therefore cannot statically import the engine. It has to fork it by path. `engine-only-contracts` restricts the engine to `packages/engine` and `packages/contracts`, so the engine parses gateway documents itself through `@recompose/contracts` rather than receiving pre-parsed objects from an app module.

**Repository finding.** `apps/desktop/electron.vite.config.ts` declares only `main`, `preload`, and `renderer`. No entry builds a utilityProcess script today. electron-vite supports this through a `?modulePath` import suffix that yields the bundled path. ([electron-vite development guide](https://electron-vite.org/guide/dev))

**Repository finding.** `docs/adr/0028-security-baseline.md` turns on the `OnlyLoadAppFromAsar` and `EnableEmbeddedAsarIntegrityValidation` fuses, and `apps/desktop/electron-builder.yml` unpacks only `resources/**`. The engine bundle must therefore ship _inside_ the asar. Forking from inside an asar is a documented rough edge ([electron/electron#2708](https://github.com/electron/electron/issues/2708), [electron-builder#5706](https://github.com/electron-userland/electron-builder/issues/5706)), and dropping the engine into `asarUnpack` to dodge it would fight the fuse.

**Finding.** Electron's `utilityProcess` docs describe `kill()` as graceful (SIGTERM on POSIX, with reaping), but `process.exit()` inside a utility process does not stop execution immediately, unlike Node worker threads and child processes. ([Electron utilityProcess docs](https://www.electronjs.org/docs/latest/api/utility-process), [electron/electron#44174](https://github.com/electron/electron/issues/44174))

**Acceptance criteria**

- AC-31: The engine is forked by resolved path, and `pnpm run lint:boundaries` stays green, which means no static import from `apps/desktop` into `packages/engine`.
- AC-32: The engine bundle is present inside the packaged asar and the app starts the engine from a packaged build, verified against a real `build:mac` or `build:linux` artifact rather than only in dev. ADR-0028 set the precedent of reading fuses back from a real package.
- AC-33: Quitting the app terminates the engine process. No orphan holds the port, which is the exact failure LM Studio users report.
- AC-34: The engine's own shutdown does not rely on `process.exit()` taking effect synchronously.

---

## Where the evidence is thin

- **AC-17 (`/v1/models` for an empty gateway).** Real complaints exist about clients and `/v1/models`, but I found no vendor statement that a client requires the endpoint. Treat as a candidate.
- **macOS firewall behavior (section 1).** The primary source is a 2018 pgsql-hackers message. It is precise and from a credible author, but it is eight years old and Apple's firewall has changed since. Verify on the actual matrix before relying on it.
- **OpenAI's 404 envelope.** OpenAI's official error-codes page does not document a 404 row. The `model_not_found` shape is well attested in SDK behavior and community reports but is not on a canonical vendor page, so cite the SDK, not the docs page, if this ends up in an ADR.
- **The Anthropic-side streaming delta-drop bug** ([BerriAI/litellm#30014, 2026-06-09](https://github.com/BerriAI/litellm/issues/30014)) is real and worth a bookmark for the first streaming feature, but no provider connects in this change, so it produces no criterion here.

---

## Recommendation

Take AC-1, AC-4, AC-9, AC-13, AC-14, AC-18, AC-23, and AC-24 as blocking for this change. They are the ones where the current artifacts are either silent or wrong, and where the cost of retrofitting is high: an address family baked into a released listener, an error envelope clients have already parsed, a slug rule people have already used, and a silent-overwrite defect that destroys a person's gateway.

Three items are contradictions inside the change itself rather than external findings, and they want a decision before implementation starts: the missing failed state (AC-6), the base-URL preview that is right for one dialect and wrong for the other (AC-11), and the token switch the engine does not read (AC-19). Two more are unspecified behavior a person will hit in the first hour: a gateway created while running (AC-28) and a port changed while running (AC-29).

The push-channel design (AC-27) is the one piece that needs its own architecture decision record, because ADR-0018 named it as the open residual this feature closes.

---

### Sources

- [Node.js `net` docs, `server.listen` and the `'error'` event](https://nodejs.org/api/net.html#serverlisten)
- [Node.js `http` docs, `server.close` / `closeAllConnections` / `closeIdleConnections`](https://nodejs.org/api/http.html#serverclosecallback)
- [Node.js `dns.setDefaultResultOrder`, default `verbatim` since v17.0.0](https://nodejs.org/api/dns.html#dnssetdefaultresultorderorder)
- [nodejs/node#56137, `dns.lookup('localhost')` returning only `::1`](https://github.com/nodejs/node/issues/56137)
- [ECONNREFUSED ::1 on Node 17/18, write-up 2023-07-28](https://serebrov.github.io/html/2023-07-28-node-econnrefused-localhost.html)
- [Tom Lane, pgsql-hackers, 2018-07-26, macOS firewall and loopback binds](https://www.postgresql.org/message-id/18689.1532641517%40sss.pgh.pa.us)
- [NCC Group, Ollama DNS rebinding, CVE-2024-28224, 2024-04-08](https://www.nccgroup.com/research-blog/technical-advisory-ollama-dns-rebinding-attack-cve-2024-28224/)
- [Anthropic API errors, error envelope and SDK retry defaults](https://platform.claude.com/docs/en/api/errors)
- [OpenAI error codes guide](https://developers.openai.com/api/docs/guides/error-codes)
- [openai-node README, error classes, retries, timeouts](https://github.com/openai/openai-node)
- [vercel/ai#15542, ANTHROPIC_BASE_URL `/v1` convention conflict, 2026-05-22](https://github.com/vercel/ai/issues/15542)
- [rohitg00/agentmemory#628, doubled `/v1` silent 404](https://github.com/rohitg00/agentmemory/issues/628)
- [BerriAI/litellm#8350, trailing slash producing `//chat/completions`](https://github.com/BerriAI/litellm/issues/8350)
- [openai/openai-go#160, base URL path tail corruption](https://github.com/openai/openai-go/issues/160)
- [openai/openai-python#1373, inconsistent `base_url` trailing slash](https://github.com/openai/openai-python/issues/1373)
- [sigoden/aichat#767, trailing slash in `api_base` causing 404](https://github.com/sigoden/aichat/issues/767)
- [LiteLLM SERVER_ROOT_PATH incident report, 2026-01-22 to 2026-01-26](https://docs.litellm.ai/blog/server-root-path-incident)
- [LiteLLM proxy health endpoints](https://docs.litellm.ai/docs/proxy/health)
- [Kubernetes API health checks, `z` suffix rationale](https://www.kubernetes.io/docs/reference/using-api/health-checks/)
- [Ollama OpenAI compatibility, `/v1` in the base URL](https://docs.ollama.com/api/openai-compatibility)
- [LM Studio OpenAI compatibility endpoints](https://lmstudio.ai/docs/developer/openai-compat)
- [LM Studio port conflict, silent failure and orphaned sockets](https://markaicode.com/errors/lm-studio-port-conflict-fix/)
- [replicate/cog#1099, macOS port 5000 held by AirPlay Receiver](https://github.com/replicate/cog/issues/1099)
- [Apple Developer Forums 682332, Control Center listening on ports](https://developer.apple.com/forums/thread/682332)
- [Electron utilityProcess docs](https://www.electronjs.org/docs/latest/api/utility-process)
- [electron/electron#44174, `process.exit()` in a utility process](https://github.com/electron/electron/issues/44174)
- [electron/electron#2708, forking from inside an asar](https://github.com/electron/electron/issues/2708)
- [electron-builder#5706, module not found inside app.asar](https://github.com/electron-userland/electron-builder/issues/5706)
- [electron-vite development guide, `?modulePath` for child processes](https://electron-vite.org/guide/dev)
- [cline/cline#8030, OpenAI-compatible model list regression](https://github.com/cline/cline/issues/8030)
- [Cline OpenAI-compatible provider docs](https://docs.cline.bot/provider-config/openai-compatible)
- [BerriAI/litellm#30014, Anthropic streaming adapter drops first text delta, 2026-06-09](https://github.com/BerriAI/litellm/issues/30014)

### Repository references (paths relative to the repository root)

- `openspec/changes/first-gateway-and-engine/proposal.md`
- `openspec/changes/first-gateway-and-engine/specs/gateways/spec.md`
- `openspec/changes/first-gateway-and-engine/specs/engine/spec.md`
- `packages/contracts/src/gateway-config.ts` (slug regex, `virtualModels` min 1, required `layout`)
- `packages/contracts/src/settings.ts` (`ENGINE_PORT_RANGE`, default port 8397, `requireGatewayToken`)
- `packages/contracts/src/ipc.ts` (closed error-code set, invoke-only channel map, no engine channels)
- `apps/desktop/src/main/storage/gateway-store.ts` (silent overwrite on duplicate slug)
- `apps/desktop/src/main/ipc/storage-ipc.ts` (`gateways:save` path, no uniqueness check)
- `.dependency-cruiser.cjs` (`desktop-not-into-engine`, `engine-no-electron`, `engine-only-contracts`, `headless-scope`)
- `apps/desktop/electron.vite.config.ts` (no engine build entry)
- `apps/desktop/electron-builder.yml` (`asarUnpack: resources/**` only)
- `docs/adr/0002-engine-in-electron-utilityprocess.md`
- `docs/adr/0005-single-port-path-per-gateway.md` (reserved gateway names, `v1`)
- `docs/adr/0018-typed-ipc-with-result-envelope.md` ("Push-style updates remain unsolved until the engine lands")
- `docs/adr/0028-security-baseline.md` (asar fuses constraining the engine bundle location)
- `docs/adr/0047-gateway-token-vault-and-clipboard.md` (the token the engine must read)
