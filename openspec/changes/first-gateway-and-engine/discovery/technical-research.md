# Discovery brief: `first-gateway-and-engine` (tier full)

Research date: 2026-07-30. Every external claim carries a link; every repository claim names a path relative to the repository root. Where evidence is thin or sources disagree, the brief says so instead of guessing.

---

## 1. Repository baseline (what the feature inherits)

Read before researching, so the recommendations land on the code that exists:

| Fact                                                                                                                                                                                                                                                                                                                | Where                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `packages/engine` **does not exist yet** (no `packages/engine/package.json`); the workspace globs `apps/*` and `packages/*`                                                                                                                                                                                         | `pnpm-workspace.yaml`                                 |
| Boundary rules for the unbuilt package **already exist**: `engine-no-electron`, `engine-only-contracts` (engine may import only `packages/engine` and `packages/contracts`), `desktop-not-into-engine` (apps/desktop must not depend on packages/engine), plus a `headless-scope` rule for a future `apps/headless` | `.dependency-cruiser.cjs` lines 52-81                 |
| `gatewayConfigSchema` requires `virtualModels` non-empty (`.min(1)`), slug regex is `^[a-z0-9](?:[a-z0-9]\|-(?=[a-z0-9]))*$`, and the config carries no `id` (slug is identity)                                                                                                                                     | `packages/contracts/src/gateway-config.ts`            |
| `enginePort` defaults to `8397`, constrained to 1024-65535                                                                                                                                                                                                                                                          | `packages/contracts/src/settings.ts`                  |
| The IPC contract is a **request/response map only**; `RecomposeIpc` is `(request) => Promise<response>` per channel. There is no push/event channel type                                                                                                                                                            | `packages/contracts/src/ipc.ts`                       |
| Closed IPC error-code set: `vault-unavailable \| vault-newer-schema \| settings-newer-schema \| validation-failed \| storage-failed \| folder-open-failed \| token-missing`. No slug-conflict code, no engine code                                                                                                  | `packages/contracts/src/ipc.ts`                       |
| `saveGatewayConfig` writes `join(dir, \`${config.slug}.json\`)` with no existence check, so a duplicate slug **silently overwrites**                                                                                                                                                                                | `apps/desktop/src/main/storage/gateway-store.ts`      |
| Preload enumerates 12 invoke channels literally and freezes the object                                                                                                                                                                                                                                              | `apps/desktop/src/preload/index.ts`                   |
| Sender trust accepts only `app://renderer` or the dev-server origin; permissions deny by default                                                                                                                                                                                                                    | `docs/adr/0028-security-baseline.md`                  |
| ADR-0002 already decided: engine in `utilityProcess`, zero `electron` imports, Node `http` + SSE judged sufficient at loopback scale                                                                                                                                                                                | `docs/adr/0002-engine-in-electron-utilityprocess.md`  |
| ADR-0005 already decided: one port, path per gateway, both dialects always, and flags "path routing must reserve gateway names that collide with API paths (`v1`, etc.)" as an open cost                                                                                                                            | `docs/adr/0005-single-port-path-per-gateway.md`       |
| ADR-0018 records an explicit residual: "Push-style updates remain unsolved until the engine lands."                                                                                                                                                                                                                 | `docs/adr/0018-typed-ipc-with-result-envelope.md`     |
| `requireGatewayToken` exists in settings and the token lives in the vault under `gateway-token`; the engine is the intended consumer                                                                                                                                                                                | `docs/adr/0047-gateway-token-vault-and-clipboard.md`  |
| MIT and Apache-2.0 are on the license allowlist                                                                                                                                                                                                                                                                     | `.claude/workflows/check-licenses/check-licenses.mts` |
| New dependencies must be at least 3 days old (`minimumReleaseAge: 4320` minutes) unless excluded                                                                                                                                                                                                                    | `pnpm-workspace.yaml`                                 |

---

## 2. Finding: HTTP server library for `packages/engine`

**Recommendation: Hono + `@hono/node-server`, not raw `node:http`, not Fastify.**

Candidates measured:

- **Hono** 4.12.32, MIT, **zero runtime dependencies**, `engines.node >=16.9.0` ([registry.npmjs.org/hono/latest](https://registry.npmjs.org/hono/latest)). Adapter `@hono/node-server` 2.0.12, MIT, peer `hono: ^4`, `engines.node >=20` ([registry.npmjs.org/@hono/node-server/latest](https://registry.npmjs.org/@hono/node-server/latest)).
- **Fastify** 5.10.0, MIT, **15 runtime dependencies** ([npmjs.com/package/fastify](https://www.npmjs.com/package/fastify)).
- **Raw `node:http`** — zero dependencies, but hand-rolled routing, method matching, body parsing, and error envelopes.

The decisive argument is testability under this repo's TDD rules, not throughput. Hono's `app.request()` runs a full end-to-end request against the app **without binding a port**: "The `app.request()` method enables 'End-to-End' testing by directly passing Request objects to your Hono application, eliminating the need for network connections or port binding" ([hono.dev/docs/guides/testing](https://hono.dev/docs/guides/testing)). That means every behavior spec in `.claude/rules/tdd-bdd.md` terms (slug routing, unknown-slug refusal, health answer, typed refusal) is a pure function over Request/Response, with the socket mocked only at the one real process boundary the rules permit. Only the two genuinely socket-shaped scenarios (binds loopback at the stored port; port already taken) need a real listener.

`@hono/node-server` returns a real Node server, so the lifecycle requirements stay reachable: `createAdaptorServer(options: Options): ServerType` and `serve(options, listeningListener?): ServerType`, and `serve` passes `options.hostname` straight through to `server.listen(port, hostname, ...)` ([node-server/src/server.ts](https://raw.githubusercontent.com/honojs/node-server/main/src/server.ts)). That preserves `server.close()`, `server.closeAllConnections()`, and the `'error'` event.

Counter-arguments recorded honestly:

- ADR-0002 already stated "Node's `http` and Server-Sent Events (SSE) streaming are sufficient", so Hono is a _new_ decision that needs its own ADR rather than an assumed continuation.
- Two dependencies land in a package whose whole point is isolation. Both are MIT (allowlisted) and Hono has zero transitive runtime deps, which keeps the surface small.
- Benchmarks favouring Hono (~142k req/s vs Fastify ~118k vs Express ~52k) come from secondary comparison sites, not vendor benchmarks ([apiscout.dev](https://apiscout.dev/guides/hono-vs-fastify-vs-express-api-framework-2026), [pkgpulse.com](https://www.pkgpulse.com/guides/hono-vs-express-vs-fastify-vs-elysia-2026)). **Throughput is irrelevant here** and should not appear in the ADR as a reason.
- **Thin evidence:** I found no first-party documentation on `@hono/node-server`'s SSE streaming behaviour under Node, and the adapter README does not document `serve()`'s return type (I had to read the source). If streaming fidelity matters for the _next_ feature, verify with a spike before committing.

If the maintainer prefers to hold ADR-0002's line, raw `node:http` remains defensible; the cost is hand-rolling routing and losing the port-free test path.

---

## 3. Finding: loopback binding is necessary but not sufficient

The spec says "Binding any other interface MUST NOT happen." Two implementation details decide whether that promise holds.

**Bind the literal `127.0.0.1`, never the string `localhost`.** Node 17 changed DNS result ordering to follow the OS instead of forcing IPv4 first, so `listen(port, 'localhost')` can bind `::1` only, or `127.0.0.1` only, depending on the host's `/etc/hosts` and stack ([nodejs/node#33816](https://github.com/nodejs/node/issues/33816), [grouparoo.com/blog/node-js-and-ipv6](https://www.grouparoo.com/blog/node-js-and-ipv6)). A client that resolves the other family gets a connection refusal that looks like "the engine is down". This is a live cross-platform risk given the three-OS target.

**Loopback binding alone does not stop a browser.** The MCP specification (revision 2025-06-18) states normatively: "Servers **MUST** validate the `Origin` header on all incoming connections to prevent DNS rebinding attacks", "When running locally, servers **SHOULD** bind only to localhost (127.0.0.1)", and "Servers **SHOULD** implement proper authentication for all connections" ([modelcontextprotocol.io/specification/2025-06-18/basic/transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)).

This is not theoretical. The MCP TypeScript SDK shipped DNS-rebinding protection **disabled by default** and drew CVE-2025-66414 / GHSA-w48q-cv73-mx4w, CVSS 7.6 High, published 2 December 2025, fixed in 1.24.0. The advisory's fix is exactly Host-header validation plus an origin allowlist ([GHSA-w48q-cv73-mx4w](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-w48q-cv73-mx4w)). The underlying attack is well documented: any HTTP server without TLS, without authentication, and without Host-header validation is reachable from a malicious page via DNS rebinding ([brannondorsey, "Attacking Private Networks from the Internet with DNS Rebinding"](https://medium.com/@brannondorsey/attacking-private-networks-from-the-internet-with-dns-rebinding-ea7098a2d325)).

Concrete recommendation for this feature:

1. `listen(enginePort, '127.0.0.1')`.
2. Reject any request whose `Host` header is not `127.0.0.1:<port>` or `localhost:<port>`. This is the DNS-rebinding stopper, because a rebinding request carries the attacker's hostname.
3. Reject any request that carries an `Origin` header at all. CLI clients (Claude Code, Codex, the OpenAI/Anthropic SDKs) send no `Origin`; only browsers do. An allowlist of zero origins is the right default here and is stricter than the MCP SDK's localhost allowlist.
4. Note that `requireGatewayToken` (ADR-0047) is the third MCP leg (authentication) and is already built but unconsumed. This feature does not have to wire it, but the ADR should say why not.

**Watch out:** LM Studio ships the opposite posture. "The LM Studio server applies no API key or token-based authentication. Access control relies entirely on the loopback bind (127.0.0.1)" ([cohorte.co](https://cohorte.co/blog/lm-studio-production-grade-local-llm-server) — secondary source, not LM Studio's own docs). Do not treat that as prior art worth copying; the MCP CVE is the more recent and more authoritative signal.

---

## 4. Finding: path-per-gateway has strong prior art, and the `/v1` split is the detail that bites

**Prior art validates the shape.** Cloudflare AI Gateway's base URL is `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/{provider}`, where the gateway identifier is a plain path segment ([developers.cloudflare.com/ai-gateway/get-started](https://developers.cloudflare.com/ai-gateway/get-started/)). ADR-0005's design is the same idea at loopback scale.

**The detail worth designing around:** the two client dialects put `/v1` in different places.

- Anthropic clients take a **bare origin**. The vLLM integration guide sets `ANTHROPIC_BASE_URL=http://localhost:8000` with no `/v1` ([docs.vllm.ai claude_code](https://docs.vllm.ai/en/stable/serving/integrations/claude_code/)), and the client appends `/v1/messages`. Claude Code's own reference describes `ANTHROPIC_BASE_URL` as "Override the API endpoint to route requests through a proxy or gateway" and **does not document the appended path** ([code.claude.com/docs/en/env-vars](https://code.claude.com/docs/en/env-vars)).
- OpenAI clients conventionally include `/v1` in the base URL (`OPENAI_BASE_URL=https://api.openai.com/v1`), then append `/chat/completions`. Ollama users hit 404s precisely when they omit it ([ollama OpenAI-compatibility issue reports](https://github.com/ollama/ollama/issues/2474)).

Both therefore land on `/{slug}/v1/...`, which is good news: **first-segment routing works unchanged for both dialects**, and the copy affordance in the sheet can advertise one address, `http://localhost:8397/{slug}`, for Anthropic clients and `http://localhost:8397/{slug}/v1` for OpenAI clients. The preview string in the spec (`http://localhost:PORT/SLUG`) is the Anthropic form; the design phase should decide whether the sheet says so.

**Reserved-slug question (ADR-0005's open cost):** under strict first-segment routing there is no collision, because nothing is served at the top level. A gateway slugged `v1` simply answers at `/v1/v1/messages`. The collision only appears if the engine ever adds a top-level route (a global `/health`, a future admin path). Recommendation: keep first-segment routing total (no top-level routes at all, or reserve exactly the names you add), and record that choice, rather than pre-reserving a speculative list. That is the YAGNI-consistent reading of `.claude/rules/clean-code.md`.

---

## 5. Finding: the typed refusal has two authoritative shapes, and only one of them is formally specified

The spec requires "a typed refusal ... a shape a client can read". Because ADR-0005 says every gateway always serves both dialects, the refusal must be dialect-correct or the client SDK will mis-parse it.

**Anthropic — exactly specified.** "The API always returns errors as JSON, with a top-level `error` object that always includes a `type` and `message` value. The response also includes a `request_id` field":

```json
{
  "type": "error",
  "error": { "type": "not_found_error", "message": "The requested resource could not be found." },
  "request_id": "req_011CSHoEeqs5C35K2UUqR7Fy"
}
```

Status/type pairs: 400 `invalid_request_error`, 401 `authentication_error`, 402 `billing_error`, 403 `permission_error`, 404 `not_found_error`, 409 `conflict_error`, 413 `request_too_large`, 429 `rate_limit_error`, 500 `api_error`, 504 `timeout_error`, 529 `overloaded_error` ([platform.claude.com/docs/en/api/errors](https://platform.claude.com/docs/en/api/errors), living document, retrieved 2026-07-30).

**OpenAI — de facto, not published as a schema.** I could not find a first-party JSON example. OpenAI's error-codes guide documents `error.code`, `error.type`, and `message` in prose but shows no sample body ([developers.openai.com/api/docs/guides/error-codes](https://developers.openai.com/api/docs/guides/error-codes)). The strongest first-party evidence is the SDK: `openai-node`'s `APIError` reads `data?.['code']`, `data?.['param']`, `data?.['type']`, and `error?.message` off the body, and maps 400→`BadRequestError`, 401→`AuthenticationError`, 403→`PermissionDeniedError`, 404→`NotFoundError`, 409→`ConflictError`, 422→`UnprocessableEntityError`, 429→`RateLimitError`, ≥500→`InternalServerError` ([openai-node/src/core/error.ts](https://raw.githubusercontent.com/openai/openai-node/master/src/core/error.ts)). Independent implementations converge on the same envelope, e.g. LocalAI publishes it verbatim ([localai.io/reference/api-errors](https://localai.io/reference/api-errors/)):

```json
{ "error": { "code": 400, "message": "...", "type": "invalid_request_error", "param": null } }
```

**Say this plainly in the ADR:** the Anthropic envelope is documented by the vendor; the OpenAI envelope is inferred from the vendor's own SDK plus convergent third-party implementations. That is a real evidence-strength difference and a reviewer should see it.

**Status code for "gateway holds no virtual model": 404.** Both ecosystems already use 404 for an unresolvable model (Anthropic `not_found_error`; OpenAI's "The model `x` does not exist or you do not have access to it" with type `invalid_request_error`, reported consistently across issue trackers — [community.openai.com](https://community.openai.com/t/api-returning-404-model-not-found-all-of-a-sudden-why-and-how-to-fix/679777)). Every client SDK already has a retry-free, typed branch for 404, which is exactly the behaviour recompose wants. 503 would invite SDK retry loops against a gateway that will never answer.

**Unknown slug:** also 404, but the message must name the slug (spec requirement). Since the dialect is unknown before the path resolves, pick one envelope by the requested path suffix (`/v1/messages` → Anthropic, `/v1/chat/completions` → OpenAI) and fall back to the Anthropic shape, which is the one with a published contract.

---

## 6. Finding: there is no live health-check standard to conform to

The obvious candidate is dead. `draft-inadarei-api-health-check` reached `-06` on 16 October 2021, is **no longer active**, and carries the disclaimer that it "is not endorsed by the IETF and has no formal standing in the IETF standards process" ([datatracker.ietf.org](https://datatracker.ietf.org/doc/draft-inadarei-api-health-check/)). Do not cite it as a standard.

Prior art instead:

- **LiteLLM** splits three ways: `/health/liveliness` (unprotected, "I'm alive!"), `/health/readiness` (returns status plus version and dependency state), `/health` (actually calls each model) ([docs.litellm.ai/docs/proxy/health](https://docs.litellm.ai/docs/proxy/health)).
- **LM Studio** has no dedicated health path; clients probe `GET /v1/models` ([lmstudio.ai/docs/developer/openai-compat](https://lmstudio.ai/docs/developer/openai-compat)).

Recommendation: `GET /{slug}/health` returning 200 with a small JSON body carrying the slug, matching the spec scenario ("answers with a success carrying that gateway's slug"). Skip liveness/readiness splitting (YAGNI — one process, no orchestrator). Note in the ADR that `/{slug}/v1/models` will become the de facto probe once models exist, so the health path is a recompose-internal affordance rather than a client-facing contract.

---

## 7. Finding: the `utilityProcess` fork path has a built-in solution, and it collides with an existing boundary rule

**Built-in solution (per `CLAUDE.md`'s search-before-build rule).** electron-vite ships first-class support: "The default export with `?modulePath` suffix will be the worker bundle path", used as

```js
import forkPath from './fork?modulePath';
const child = utilityProcess.fork(forkPath);
```

with `MessageChannelMain` for the port handoff, and no extra config required ([electron-vite.org/guide/dev](https://electron-vite.org/guide/dev)). `apps/desktop/electron.vite.config.ts` currently has `main: {}`, so nothing blocks this.

Electron's own API: `utilityProcess.fork(modulePath[, args][, options])`, events `spawn` / `exit` / `error` / `message`, `child.postMessage(message, [transfer])`, and `kill()` which "terminates the process gracefully. On POSIX, it uses SIGTERM but will ensure the process is reaped on exit". The process must be created after `app.ready` ([electronjs.org/docs/latest/api/utility-process](https://www.electronjs.org/docs/latest/api/utility-process)).

**The collision — flag this for the design phase.** `.dependency-cruiser.cjs` carries `desktop-not-into-engine` (`from: ^apps/desktop/`, `to: ^packages/engine/`, severity error), a _direct_-dependency rule with no `reachable: true`. Any statically resolvable import from main into the engine package trips it. The `?modulePath` form is likely to be unresolvable to dependency-cruiser and therefore trip `not-to-unresolvable` instead, whose `pathNot` currently excludes only `\\?asset$` (line 92). **I did not run `pnpm run lint:boundaries` to confirm which rule fires** — treat this as a hypothesis to verify with one command, not a finding. Either way the rule set needs a reviewed change, and that change belongs in the ADR rather than in a quiet config edit.

**Lifecycle mechanics, verified:**

- `EADDRINUSE` is **emitted as an `'error'` event, not thrown from `listen()`**. Node's own example shows `server.on('error', (e) => { if (e.code === 'EADDRINUSE') ... })` ([nodejs.org/api/net.html](https://nodejs.org/api/net.html#event-error_1)). The spec's "the report names the port" therefore has to come from an event handler attached before `listen`, and the engine must report failure back over the port rather than crashing the child.
- Graceful stop: `server.close()` (added v0.1.90) stops accepting connections; **as of Node v19.0.0 it also closes idle keep-alive connections automatically**. `server.closeAllConnections()` (added v18.2.0) force-closes established connections and "should be called after `server.close()` to avoid race conditions" ([nodejs.org/api/http.html](https://nodejs.org/api/http.html#serverclosealllconnections)). Root `engines.node` is `^22.18.0 || >=23.6.0` (`package.json`), so the v19 behaviour is guaranteed. For "the server stops listening", `close()` then `closeAllConnections()` is the correct pair; do not rely on `close()` alone with keep-alive clients like the Anthropic SDK.
- Config handoff: the `engine-only-contracts` rule lets the engine import `@recompose/contracts`, so it _could_ read the gateway files itself. Recommend against it. Main already owns storage (`apps/desktop/src/main/storage/gateway-store.ts`) and the vault, and ADR-0047 established "act on the plaintext in main" as precedent. Have main post the port and gateway list to the child over the `MessagePort`, keeping the engine a pure function of its input and trivially testable without a filesystem double.

---

## 8. Finding: the lifecycle report needs a channel kind the contract does not have

`packages/contracts/src/ipc.ts` models only `(request) => Promise<response>`. "The engine reports running and stopped state to the main process, and the main process MUST carry that state to the screen" needs main→renderer push, which ADR-0018 explicitly deferred ("Push-style updates remain unsolved until the engine lands").

Electron's Pattern 3 is the reference. The preload shape is:

```js
contextBridge.exposeInMainWorld('electronAPI', {
  onUpdateCounter: (callback) =>
    ipcRenderer.on('update-counter', (_event, value) => callback(value)),
});
```

with the security caveat quoted verbatim: "don't just pass the callback to `ipcRenderer.on` as this will leak `ipcRenderer` via `event.sender`. Use a custom handler that invokes the `callback` only with the desired arguments" ([electronjs.org/docs/latest/tutorial/ipc](https://www.electronjs.org/docs/latest/tutorial/ipc)).

**Gap worth naming:** Electron's docs "do not explicitly demonstrate listener cleanup" for this pattern. A React subscriber must return an unsubscribe, so the preload entry should return a disposer (wrapping `ipcRenderer.off`) rather than `void`, or the renderer leaks listeners across route changes.

Two design consequences for the contracts package:

1. A second map (`ipcEvents`) beside `ipcChannels`, with its own derived type, keeps ADR-0018's "compile-time totality" property. Folding push channels into `ipcChannels` would break `RecomposeIpc`'s request→response shape.
2. `ipcErrorSchema`'s closed code set has nothing for a start failure. "Port already taken" is an expected, typed failure under `.claude/rules/clean-code.md` ("Model expected failures ... as typed results/states"), so it needs a code (`engine-port-taken` or similar) rather than a generic `storage-failed`.

**Renderer side:** push the event into the TanStack Query cache rather than into component state. The community-documented split is `setQueryData` when you already hold the new value and `invalidateQueries` when derived data must re-sync ([TanStack Query docs on invalidation](https://tanstack.com/query/v5/docs/framework/react/guides/query-invalidation), [QueryClient reference](https://tanstack.com/query/v5/docs/reference/QueryClient)). Engine state is a small self-contained value, so `setQueryData` on an engine-state key fits, with the gateway list untouched. **Caveat:** I found no first-party TanStack guide dedicated to push transports; the `setQueryData` vs `invalidateQueries` semantics are first-party, the "use it for websockets/push" framing is secondary.

---

## 9. Finding: two concrete defects the contract change will expose

**(a) `virtualModels` widening is backward-safe but forward-unsafe.** Dropping `.min(1)` from `gatewayConfigSchema` widens the accepted set, so no migration is needed and `GATEWAY_CONFIG_VERSION` can stay `1` (an old document still parses). But `migrateDocument` throws `document schemaVersion N is newer than supported M` only on the version number (`packages/contracts/src/migration.ts`), and a v1 document containing `virtualModels: []` written by the new build will fail `.parse()` on an older build with a raw `ZodError`, not a typed result. ADR-0054 ("A Newer Settings Document Is a Typed Failure, Not Damage") established that downgrade reads should be typed, not treated as damage. Worth a sentence in the ADR deciding whether widening-without-a-version-bump is acceptable here, or whether it earns version 2.

**(b) Duplicate slug silently overwrites, and there is no error code for it.** `saveGatewayConfig` writes `${config.slug}.json` unconditionally. The spec says "the app keeps the sheet open / the slug field names the conflict". A renderer-side check against `gateways:list` satisfies the scenario, but leaves main's `gateways:save` able to destroy a gateway. Recommend a main-side existence check returning a new typed code, because `.claude/rules/clean-code.md` forbids silent failure and main is the single writer.

**(c) Windows reserved device names pass the slug regex.** `gatewaySlugSchema` accepts `con`, `prn`, `aux`, `nul`, `com1`-`com9`, `lpt1`-`lpt9`. Microsoft's naming rules say: "Do not use the following reserved names for the name of a file: CON, PRN, AUX, NUL, COM1 ... LPT9 ... **Also avoid these names followed immediately by an extension; for example, NUL.txt and NUL.tar.gz are both equivalent to NUL**", and separately "Do not assume case sensitivity" ([learn.microsoft.com, Naming Files, Paths, and Namespaces](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file), doc date 2024-08-28, updated 2025-04-11). Because `saveGatewayConfig` derives the filename from the slug, a gateway named with slug `con` fails to save on Windows in a way the code has no branch for. Given the three-OS target recorded in project memory, this is a real defect this feature would introduce. The fix is a reserved-name check in the slug validator (contracts layer, so both the sheet and main share one rule). Path traversal is _not_ a risk: the regex admits no `.`, `/`, or `\`.

---

## 10. Finding: UI details with established answers

- **Focus lands on the name field.** Base UI's Dialog takes `initialFocus`, which "determines the element to focus when the dialog is opened", accepting `false`, `true`, a RefObject, or a function. As of v1.0.0-beta.3 the function form must return the DOM element directly, which was a breaking change ([base-ui.com/react/components/dialog](https://base-ui.com/react/components/dialog), [v1.0.0-beta.3 release notes](https://base-ui.com/react/overview/releases/v1-0-0-beta-3.md)). ADR-0044 already puts Base UI at the base of the shared kit, so this is conformance, not a new choice.
- **The status dot cannot be a dot alone.** WCAG 2.2 SC 1.4.1 (Level A) forbids colour as the only visual means of conveying information; the documented remedies are a text label or accessible name, an icon or shape difference, or both ([wcag.com/designers/1-4-1-use-of-color](https://www.wcag.com/designers/1-4-1-use-of-color/)). This matters concretely because `CLAUDE.md` requires the `claude-in-chrome` semantic pass, and the recorded past failures include "an inert row that looked live". The sidebar row needs a text or `aria-label` carrier for running/stopped, not just `bg-green` vs `bg-neutral`.

---

## 11. Where the evidence is thin

State these as open, not settled:

1. **`@hono/node-server` SSE behaviour under Node** — no first-party doc found. Irrelevant to this feature (no streaming yet), load-bearing for the next one. Spike before the ADR promises it.
2. **Which dependency-cruiser rule the `?modulePath` import trips** — inferred from reading `.dependency-cruiser.cjs`, not verified by running `pnpm run lint:boundaries`. One command settles it.
3. **OpenAI's error envelope** — no vendor-published schema; inferred from the vendor SDK plus convergent implementations. The Anthropic shape is documented; the OpenAI shape is not, and the ADR should not present them as equally sourced.
4. **Framework benchmark numbers** — all secondary sources, and irrelevant at loopback scale. Do not use them as a decision reason.
5. **`ANTHROPIC_BASE_URL` path-append behaviour** — Anthropic's own reference does not state what path the client appends. The `/v1/messages` conclusion comes from vLLM's integration guide and the general SDK contract, not from Anthropic documentation.

---

## 12. Recommendation summary

1. **Hono + `@hono/node-server`** in `packages/engine`, chosen for port-free behaviour specs, not for speed. New ADR required; it revisits ADR-0002's "Node `http` is sufficient" line.
2. **Bind `'127.0.0.1'` literally.** Validate the `Host` header against `127.0.0.1:<port>` / `localhost:<port>` and reject any request carrying an `Origin`. Cite MCP's normative text and CVE-2025-66414 as the reason, and record that `requireGatewayToken` is the deliberate next leg.
3. **Total first-segment routing, no top-level routes**, which retires ADR-0005's reserved-name cost without a speculative list.
4. **404 for both refusals**, in the dialect the requested path implies, defaulting to the Anthropic envelope (the only vendor-published one).
5. **`GET /{slug}/health`** returning the slug. No liveness/readiness split. Do not cite the expired IETF draft.
6. **Fork through electron-vite's `?modulePath`**, hand config over a `MessagePort` from main, keep storage reads in main. Verify and then amend the dependency-cruiser rules in the same PR.
7. **Add an `ipcEvents` map** to `packages/contracts/src/ipc.ts` for the lifecycle push, with a preload entry that returns an unsubscribe, and add an engine start-failure code to `ipcErrorSchema`.
8. **Add a reserved-name guard to `gatewaySlugSchema`** (Windows device names) and a duplicate-slug check to `gateways:save`. Both are defects this feature would otherwise ship.
9. **Give the status dot a non-colour carrier** and use Base UI's `initialFocus` for the sheet.
