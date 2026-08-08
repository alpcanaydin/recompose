# Brainstorm decisions, parked

The maintainer parked this change at the end of discovery on 2026-08-04, after the candidate panel and three locked decisions. Dialect translation ships first as its own feature, and this change resumes on top of it, designing against the translator interface from day one, so no wrong-dialect refusal or dialect-naming sheet copy ever ships as throwaway.

## Locked decisions

1. **Custody is the hybrid.** Bindings (virtual model names, display names, target standings; never a secret) ride the start directive, so the engine answers listings and refusals from its snapshot. Secrets ride per-request spend grants: the child asks over a new correlated parent-port lane, main resolves against the live registry and vault under the vault order, and the grant lives in the handler's function scope until upstream headers arrive. Removal and key replacement take effect on the next request with no restart. ADR-0066's own consequence invites the child-initiated lane; the grant's refused arms are enums with no message field.
2. **The caller surface is in scope.** GET /v1/models answers unauthenticated on loopback with one merged body serving both dialects (id, display_name), count_tokens paths stop reading blanket 404s, and the add sheet carries the quiet Claude Code prefix hint. Typed refusals reach the wire in the arriving dialect's own envelope, and upstream bodies pass byte for byte.
3. **The real model is picked, never typed.** The sheet's Model field fills from the target account's live model list over a new probe-desk-style lane, and a failed fetch reads a typed refusal in the sheet naming the failed look. No free-text fallback. The virtual name stays free, with the derived wire id previewed through the shipped slug derivation.

## Candidate digests

- **A, smallest slice**: credentials ride the start directive whole; the engine holds a resolved serving table for the listener's lifetime; refresh is restart, and account removal restarts referencing gateways. Scored blast 4, alignment 5. Rejected on custody duration: a serving table of live keys parks in child memory while the child's pipes stream to main's console.
- **B, custody first**: per-request spend grants with main in the hot path and EngineGateway untouched; no restart discipline at all. Scored blast 2. Its grant lane and custodian module survive into the hybrid; its every-ask-resolves-names cost does not, because bindings ride the snapshot.
- **C, two persons**: the maintainer journey (Name, Target, Model field order; grouped picker from a new entities/account targetable helper; two-line row with target-removed standing; Copy model id act) and the caller journey (merged listing, five typed refusals with statuses, truthful attribution with the alias in an x-recompose header) both survive into the resumed design. Its typable model fallback died at the brainstorm; its start-directive custody yields to the hybrid.

## Resumption notes

- Rider #117's prohibition scenario graduates here: the target picker draws from a targetable-kinds helper in entities/account, and the stored target's kind enum has no subscription member, so the forbidden state has no shape.
- gateway-config moves to version 2: the router arm and weight leave the file, one strict target per virtual model, slugs unique per gateway, restamp migration (no shipped writer ever minted a virtual model).
- The refusal-status question stayed open at the park: B argues 404 for unknown-model, missing-target, and missing-credential alike (the one terminal status in both vendors' retry taxonomies), C argues 404/503/503/502. Decide at the resumed brainstorm with the translation feature's findings in hand.

## Resumed decision, 2026-08-06: refusal statuses are 404 / 502 / 502

The resumed brainstorm settled the open refusal-status question against the shipped translation feature. `RenderedRefusal` already carries an HTTP status, and the shipped gateway answers an unknown model with 404 `not_found_error`. The composition slice keeps that and splits the two config faults away from it.

- **unknown-model stays 404.** The named model does not exist and never reaches the `GET /v1/models` listing, so a not-found status is honest and terminal.
- **missing-target becomes 502.** A defined virtual model whose target left the registry still lists in `GET /v1/models`, so a 404 would contradict the listing. The model exists but the gateway cannot resolve its upstream, which is the bad-gateway condition real proxies answer with 502.
- **missing-credential becomes 502.** The target stands but the vault holds no secret, so the gateway cannot establish the upstream leg. This is the same bad-gateway class, with a distinct typed body naming the missing credential.

Both B and C are set aside. B's uniform 404 mislabels a listed model as absent. C's 503 tells the caller to retry later, but a removed target and a missing credential are permanent until the operator acts, so a transient status would lie; 502 carries no retry-later promise, and the typed body names the actionable cause. A real upstream error still passes through byte for byte per decision 2, so the slice synthesizes a status only for these three refusals.

- Claude Code sends thinking type adaptive to unrecognized names; the translation feature owns that field's mapping, so the resumed change inherits the answer instead of deferring it.
