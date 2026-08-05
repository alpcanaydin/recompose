# Rider ledger

What already stands recorded in the issue tracker and the parked change that touches
the dialect-translation surface, so planning cites it instead of rediscovering it.

## Riders that bear on this feature

Ten riders stand open with the `rider` label (#117 through #123, #136 through #138).
One touches this feature's surface:

- **#117, "A virtual model never offers a subscription target".** The screen-level
  prohibition scenario graduates with the parked gateway-virtual-models change, not
  here. Its contract half already holds structurally. This feature must not create a
  composition surface that would make the scenario driveable early; the translator
  stays a library with no serving-path wiring, so it stays out of #117's way.

The other nine do not touch translation, the serving path, the gateway, streaming, or
the parked change. #118 through #123 live on the subscription sign-in and keychain
surfaces, #136 and #137 on the local-runtime and provider-catalog surfaces, and #138
moves the key probe's fetch bound in `packages/engine/src/provider/key-probe.ts` into
contracts, which is probe-side engine code, not the serving path.

## Constraints from the parked consumer

`openspec/changes/gateway-virtual-models/discovery/brainstorm-decisions.md` stands on
branch `worktree-gateway-virtual-models` (parked 2026-08-04), not on main. It resumes
on top of this feature and designs against the translator interface from day one.
Decisions there that constrain this library's interface:

- **Pure functions inside a grant-scoped handler (locked decision 1).** Secrets ride
  per-request spend grants that live in the handler's function scope until upstream
  headers arrive. The translator runs inside that handler, so it must stay fetch-free
  and secret-free: it never sees a credential, only request and response shapes.
- **Refusals render in the arriving dialect's envelope (locked decision 2).** Typed
  refusals reach the wire in the caller's own dialect envelope, so the translator must
  expose per-dialect refusal-envelope rendering, not only happy-path translation.
- **Byte-for-byte passthrough (locked decision 2).** Upstream bodies pass byte for
  byte when no translation applies, so the interface must let the caller skip
  translation entirely rather than round-tripping same-dialect traffic.
- **Merged model listing (locked decision 2).** GET /v1/models answers with one merged
  body serving both dialects (id, display_name), and count_tokens paths stop reading
  blanket 404s; the consumer expects the translator's dialect knowledge to inform both.
- **Thinking-field mapping is owned here (resumption notes).** Claude Code sends
  thinking type adaptive to unrecognized names; this feature owns that field's mapping,
  and the resumed change inherits the answer instead of deferring it.
- **Refusal-status question stays open (resumption notes).** Candidate B argues 404
  for unknown-model, missing-target, and missing-credential alike; candidate C argues
  404/503/503/502. The resumed brainstorm decides with this feature's findings in
  hand, so this feature's discovery should record what the reference implementation
  (CLIProxyAPI) and the vendor dialects say about refusal statuses.

## Inherited precondition from ADR-0057

`docs/adr/0057-the-engine-serves-over-hono.md` (Consequences) records that the
`@hono/node-server` adapter's streaming behavior under Node lacks first-party
documentation, so a spike precedes any streaming promise in a later change. This
feature covers event streams as pure functions and wires no serving path, so the spike
stands booked for whichever change first serves a translated stream; the translator's
stream functions should be shaped so that spike tests them unchanged.
