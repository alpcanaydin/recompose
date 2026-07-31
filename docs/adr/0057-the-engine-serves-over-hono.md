# 0057: The engine serves over Hono

**Status**: Accepted
**Date**: 2026-07-31

## Context

Architecture Decision Record (ADR) 0002 judged Node's `http` module sufficient at loopback scale, and it still governs where the engine runs. The repository's testing rules hardened after that record landed. Behavior specs run state-based, with doubles only at real process boundaries, and node-side logic faces a diff-scoped mutation gate.

Hand-rolled routing multiplies the branches those gates punish. Every guard, every dialect path, and every refusal would need a socket to prove itself.

## Decision

`packages/engine` serves each gateway through a Hono app and opens sockets through `@hono/node-server`. ADR-0002 keeps the process shape it decided, and this record revisits only the transport line inside it.

Hono's `app.request()` runs every routing, guard, and refusal behavior against a real Request with no socket. Only `gateway-listener.ts` ever binds one. The adapter hands back a real Node server, which keeps `close()`, `closeAllConnections()`, and the `error` event. Both packages carry a license the repository allowlist admits, and Hono ships no runtime dependencies. Throughput isn't a reason, and no benchmark appears anywhere in this record.

The engine child stays resident across every start and stop. It holds a registry of open listeners and nothing else, and main posts each gateway to it as data. One child holds every listener, so ten gateways cost ten sockets and one process.

Nothing enforces a token this round, as a named deferral. The settings screen no longer carries the switch, and the vault still holds the token, so the gateway settings feature wires the two together when it lands.

## Alternatives

- **Raw `node:http`**: hand-rolls routing and loses the socket-free test path the mutation gate needs.
- **Fastify**: fifteen runtime dependencies inside the package the boundary rules isolate.
- **Express**: the same dependency cost over an older architecture.
- **A child process per gateway**: processes multiply memory and lifecycle code for isolation the per-port listeners already deliver.
- **The child reading gateway files itself**: main is the single writer, and a second reader invites drift.

## Consequences

**Good**: every refusal and guard behavior is a pure function over Request and Response, testable at unit speed and mutation depth. The dependency surface stays two allowlisted packages.

**Bad**: the isolation package now holds outside dependencies. The adapter's streaming behavior under Node lacks first-party documentation, so a spike precedes any streaming promise in a later change. A gateway serves without a token until the gateway settings feature lands, so anyone who reaches the loopback port reaches the quota behind it.
