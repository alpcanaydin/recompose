# Candidate approaches

Three Fable 5 writers took distinct angles on the same locked decisions: thinnest viable slice, contract and correctness first, and vertical walking skeleton.

## Self-scores

| Criterion                       | Thinnest slice | Contract first | Walking skeleton |
| ------------------------------- | -------------- | -------------- | ---------------- |
| Requirement coverage            | 9              | 9              | 8                |
| Simplicity                      | 9              | 6              | 7                |
| Testability                     | 9              | 9              | 9                |
| Rework risk when providers land | 6              | 8              | 7                |
| Blast radius                    | 8              | 6              | 6                |

## What all three converged on

These arrived independently from three angles, so they enter the design as settled rather than as one writer's preference.

### The engine

- One Hono app, pure over Request and Response, so every routing and refusal behavior runs through `app.request()` with no socket. This is the whole reason Hono won the locked decision.
- Module split: a loopback guard, refusal envelope builders, the app composition, a listener module that is the only socket-touching file, and one impure child entry.
- Bind the literal `127.0.0.1` always, and open `::1` alongside it. A machine with no IPv6 loopback degrades to IPv4 rather than failing. `EADDRINUSE` on either family fails the whole start. The `error` listener attaches before `listen`.
- Reword the spec's "one server listens" to one request handler across up to two sockets.
- Reject any request whose `Host` falls outside the loopback set, and reject any request carrying an `Origin` header at all. Both answer 403. No browser has business here and no command-line client sends an origin.
- Total first-segment routing with no top-level route of any kind.
- Both refusals answer 404 with a JSON content type, dialect picked by path suffix, falling back to the Anthropic envelope because it is the only vendor-published shape.
- `GET /{slug}/health` answers 200 carrying the slug. No liveness and readiness split.
- Stop runs `close()` then `closeAllConnections()`, and resolves only once the listeners are down. Start while running and stop while stopped are both no-ops.
- `requireGatewayToken` stays unread this round, recorded as a named deferral rather than an omission.

### The process boundary

- Main owns storage. The engine receives the port and the gateway list as data over the message port and never touches a filesystem.
- The lifecycle push gets its own map beside `ipcChannels` rather than folding into it, because folding would break the request-to-response shape of `RecomposeIpc`.
- Preload exposes a second frozen global whose entry wraps the callback, so `ipcRenderer` never leaks through `event.sender`, and returns an unsubscribe.
- The fork goes through the `?modulePath` support electron-vite already ships. The dependency-cruiser amendment lands as a reviewed diff after `pnpm run lint:boundaries` names which rule fires.

### The renderer

- `settingsQueryOptions` moves down from the settings page to `shared/api`, which resolves the same-layer cross-import that Steiger rejects. The writer hook stays page-local.
- The `widgets` layer opens with a gateway sidebar and an engine toolbar.
- `shared/ui` gains a sheet primitive on the Base UI dialog with `initialFocus`, and a status indicator that pairs the dot with a text carrier.
- Push writes into the query cache through `setQueryData` rather than invalidating.

### Defects absorbed

- The duplicate-slug overwrite is fixed in main, because a renderer list can be stale.
- The slug rule gains a length bound and a Windows device-name refusal, in contracts, so the sheet and main share one rule by construction.

## Where the three disagree

### Is a failed start an error code or a state?

Two writers put it in the state union that the invoke response and the push payload share, so one representation drives the dot and the error line. One writer puts `engine-port-taken` into `ipcErrorSchema`.

The argument against the state reading comes from the writer who chose it: every other expected failure in the app crosses the boundary as `ok: false` with a code, so engine failures becoming states leaves two failure vocabularies on one surface.

### Reserve `v1` and `health` as slugs?

One writer reserves both now. Two defer, on the ground that total first-segment routing leaves no path for a collision to exist in.

Both deferring writers argue against their own choice in their closing critique: this change is the only moment the project will ever have zero stored documents, and a rule added later invalidates data a rule added now costs nothing.

### Cluster shape

One writer bundles contracts, the engine skeleton, the host skeleton, preload, and config into a single serial spine that ends with a Playwright proof forking a real child and fetching a real socket, then fans out five ways. Two writers land contracts alone, then fan out wide.

The spine retires the two unverified risks in its first commits. Its own critique names the cost: the widest fan-out sits behind the narrowest bottleneck, and a protocol frozen before any thickening test pressure becomes coordinated rework across three clusters if it turns out wrong.

### Child process model

Two writers keep one resident child across start and stop, opening and closing listeners inside it. One writer forks per start.

### The copy affordance

One writer routes the copy through a new channel so main composes the address, citing the token precedent. Two put the copy in the widget.
