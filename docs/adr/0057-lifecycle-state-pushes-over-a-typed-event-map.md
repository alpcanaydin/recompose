# 0057: Lifecycle state pushes over a typed event map

**Status**: Accepted
**Date**: 2026-07-31

## Context

Architecture Decision Record (ADR) 0018 shipped an invoke-only Inter-Process Communication (IPC) surface. Its own consequences recorded the residual in one line: push-style updates remain unsolved until the engine lands.

The engine lands with this change. Per-gateway state has to reach the sidebar, the toolbar, and the menu bar tray without polling, and all three have to agree.

## Decision

A second map, `ipcEvents`, sits beside `ipcChannels` in contracts, with derived types mirroring the invoke surface's totality. The one event, `engine:state`, carries the whole per-gateway snapshot rather than a delta, so a subscriber that misses one push heals on the next.

Preload exposes a second frozen global, `recomposeEvents`. Each entry wraps the caller's listener in a handler of its own, so `ipcRenderer` never leaks through `event.sender`, and each returns a disposer that unregisters exactly that handler. The renderer writes the payload into the query cache through `setQueryData` on the engine-states key. An `engine:states` invoke channel serves the first paint, so no surface renders a guess while it waits.

A failed start rides inside that same state union. The invoke response and the push payload share one per-gateway shape, and a failed start answers `ok: true` carrying a stopped status beside the port it wanted. The indicator, the error line, and the tray submenu read one value, so no two surfaces can disagree about a gateway's condition.

The cost stands recorded rather than hidden. Every other expected failure crosses as `ok: false` with a code, so this surface carries two failure vocabularies. One rule separates them. A failure that refuses an act crosses as a code, and a failure that describes a gateway's condition rides inside the state.

## Alternatives

- **Folding push channels into `ipcChannels`**: breaks the request-to-response shape `RecomposeIpc` derives from.
- **Polling a status channel**: trades latency for timer noise on a surface a push serves exactly.
- **Delta events per gateway**: deltas need ordering rules and resynchronization logic a snapshot makes unnecessary.
- **Component state instead of the query cache**: three consumers would each hold a copy of their own.
- **An `engine-port-taken` error code**: the push would still need a state shape, leaving one fact spelled two ways on one surface.

## Consequences

**Good**: the push surface carries compile-time totality like the invoke surface. State that arrives by invoke can never disagree with state that arrives by push.

**Bad**: preload now maintains two frozen globals by hand. Every future event costs one map entry, one preload line, and one type assertion. A reader meets two failure shapes on one surface and has to learn which rule picks each.
