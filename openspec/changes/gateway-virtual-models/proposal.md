# Gateway virtual models, the first composition slice

## Why

A gateway opens its loopback port and answers, but nothing yet maps a model name a client sends onto a real account and a real model. The shipped serving path answers every model request with a typed 404, because no virtual model exists for it to serve. This change mints the first one. A person names a virtual model and binds it to one stored account and one real model. The gateway then forwards traffic arriving under that name to that target. This is the first time a stored credential spends on live traffic.

The dialect-translation library shipped first on purpose, so a request in one dialect reaches a target that speaks another. This change consumes that library at the serving seam and adds nothing to it. The composition surface it opens is also the surface a deferred rider waited on. `provider-subscriptions` parked its tenth scenario, a gateway never offering a subscription target, because no screen carried a composition surface yet. This change is that screen, and the prohibition graduates here.

The slice stays narrow by design. One virtual model binds to one target. No router, no pool, no failover ladder, and no canvas. Each of those arrives as its own later feature, when topology becomes real. The industry calls this mapping a virtual model or a model alias. Every close reference ships the one-to-one binding as a row with a picker rather than a diagram.

## What changes

**A virtual model binds to exactly one target.** A person defines it by a free name, a stored account, and one real model that account serves. The stored shape holds no second target, no router arm, and no fallback. `gateway-config` moves to version 2. The router node and its weight leave the file, one strict target stands per virtual model, and slugs stay unique per gateway. A restamp migration carries version 1 documents forward and rewrites only the version stamp, because no shipped writer ever minted a virtual model.

**The target picker offers three kinds and refuses the fourth at parse.** The picker draws key, aggregator, and local accounts from a targetable-kinds helper in the account entity. A subscription account stands nowhere in it. The stored target's kind enum carries no subscription member, so the forbidden state has no shape rather than a screen habit a later edit could drop.

**The person picks the real model, and never types it.** The sheet's Model field fills from the target account's live model list over a probe-style lane. A failed fetch reads a typed refusal in the sheet that names the failed look. The field accepts no free-text fallback. The virtual name stays free. The sheet previews its derived wire id through the shipped slug derivation. A quiet hint notes that Claude Code's model picker only surfaces `claude`- or `anthropic`-prefixed ids.

**The gateway proxies the virtual name to its target.** A request arriving under a defined name forwards to the target account's provider, carrying the target's real model name and the credential. The credential rides neither a command line, an environment variable, nor a disk file. It resolves per request over a correlated child-to-parent lane. The child asks, and the parent resolves against the live registry and vault. The grant lives in the handler's function scope until upstream headers arrive. Removal and key replacement take effect on the next request with no restart, because bindings ride the start directive as a snapshot while secrets ride the grant.

**Three refusals answer typed, and none falls back.** An undefined name answers 404, because the model doesn't exist and never lists. A defined model whose target left the registry answers 502. A defined model whose account holds no credential answers 502 as well. A listed model with broken backing is a bad-gateway condition, not an absent resource. A transient 503 would promise a retry that a permanent misconfiguration never earns. Each refusal renders in the arriving dialect's own envelope and names what's missing. The gateway forwards a real upstream error body byte for byte.

**The caller surface serves discovery and truthful attribution.** `GET /v1/models` answers unauthenticated on loopback with one merged body serving both dialects. It carries the id and display name of every defined virtual model. The `count_tokens` path stops reading a blanket 404. The response names the model that answered and carries `x-recompose-*` headers naming the virtual model and the target, so attribution stays truthful rather than a stable lie.

**What this change leaves out, on purpose.**

- No router, pool, or failover ladder: a virtual model binds to one target, and multi-target topology is a later feature.
- No canvas: the Models surface is a list and a sheet, which every close reference confirms as the shape for a one-to-one binding.
- No subscription target: the prohibition is a parse-level refusal, not a screen filter.

## Capabilities

### New capabilities

- `virtual-models`: a person defines a virtual model bound to one target, the picker refuses a subscription target, and the gateway proxies the virtual name to its target or answers a typed refusal that names what's missing.

### Modified capabilities

- `gateways`: the stored `gateway-config` moves to version 2, dropping the router node and its weight for one strict target per virtual model, with a restamp migration.

## Impact

- `packages/contracts/src/gateway-config.ts` moves to version 2: `virtualModelSchema` holds one target, the router node leaves, and `packages/contracts/src/migration.ts` carries version 1 forward. A targetable-target refusal rejects a subscription account kind at parse.
- `packages/contracts/src/engine-protocol.ts` widens `EngineGateway` to carry the virtual model bindings as a snapshot, so the child answers listings and refusals without a secret in the directive.
- `packages/engine/src/gateway-app.ts` gains the proxy path and the `GET /v1/models` listing, replacing the current model-path 404 handlers, and `packages/engine/src/refusals.ts` gains the missing-target and missing-credential refusals in both dialects. Every proxied request still passes `guardLoopback`.
- `packages/engine/src/engine-child.ts` gains the per-request credential lane, following the probe arm's precedent of a secret riding the message port rather than argv or env.
- `apps/desktop/src/main` resolves a target and pulls its credential at the request boundary: `engine-host` carries the grant round trip, `storage/vault.ts` answers the secret, and `storage/accounts-store.ts` detects a removed target.
- `apps/desktop/src/renderer/src/pages/gateway-canvas` gains the Models list and the add-model sheet, `entities/account` gains the targetable-kinds helper that drops subscriptions, and the flow runs through the shared `Sheet` primitive.
- Rider #117 graduates and its prohibition scenario joins the driven suite. The gateway e2e page objects extend for the Models list, the add-model sheet, and the proxied-answer path.
