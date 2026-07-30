# First-gateway-and-engine design

## Header and change linkage

- Change id: first-gateway-and-engine
- Schema: recompose
- Proposal: [proposal.md](proposal.md)
- Specs: [specs/gateways/spec.md](specs/gateways/spec.md), [specs/engine/spec.md](specs/engine/spec.md), [specs/settings/spec.md](specs/settings/spec.md)
- Discovery: [discovery/code-map.md](discovery/code-map.md), [discovery/technical-research.md](discovery/technical-research.md), [discovery/acceptance-references.md](discovery/acceptance-references.md), [discovery/design-references.md](discovery/design-references.md), [discovery/candidate-approaches.md](discovery/candidate-approaches.md), [discovery/rider-ledger.md](discovery/rider-ledger.md)
- Tasks: [tasks.md](tasks.md)

## Context

recompose stores gateway documents and carries them across the process boundary on two channels. Nothing creates one, nothing lists one, and no server answers anywhere. The canvas route renders a placeholder, and the home surface shows one sentence.

This change closes the loop. A person creates a gateway from the empty state, sees it in the sidebar, and starts it from the toolbar. The gateway answers at the root of its own loopback address. A model request answers a typed refusal that names the missing model.

Four structural gaps stand in the way. `packages/engine` doesn't exist, though `.dependency-cruiser.cjs` pre-staged its walls. The Inter-Process Communication (IPC) surface in `packages/contracts/src/ipc.ts` is invoke-only, so no push path reaches the screen. The gateway contract requires a virtual model and carries no port. The renderer holds no `widgets` layer, no sheet, no status indicator, and no green token that survives the sidebar's real backdrop.

The proposal locked the decisions. Each gateway owns its own loopback port, which supersedes Architecture Decision Record (ADR) 0005. The engine serves over Hono, which revisits ADR-0002's transport line. A failed start rides inside the engine state union. The settings screen loses its port outright. This document turns those locks into contracts, files, tests, and task boundaries.

## Discovery inputs consumed

- `discovery/code-map.md`, contracts entries: `ipc.test.ts` pins a twelve-channel roster, so the design moves the count to seventeen rather than deleting the assertion. `ipc.test-d.ts` sets the totality pattern the event map copies.
- `discovery/code-map.md`, `gateway-store.ts` entry: `saveGatewayConfig` overwrites without a check, which is why both conflict checks land in main.
- `discovery/code-map.md`, preload entry: the bridge exposes invoke only, which is why a second frozen global carries the event surface.
- `discovery/code-map.md`, spec-symbol rows: they describe the superseded shared-port engine, so they served as file pointers only. The specs on disk carry the port-per-gateway contract.
- `discovery/code-map.md`, remaining rows: consulted, no impact beyond confirming file placement.
- Research finding 2 (Hono): `app.request()` runs the whole request path with no socket, which shapes the unit row of the test matrix.
- Research finding 3 (loopback): the literal `127.0.0.1` plus `::1`, the Host guard, and the Origin refusal all come from here, backed by the Model Context Protocol (MCP) normative text and the Common Vulnerabilities and Exposures (CVE) record CVE-2025-66414.
- Research finding 7 (fork path): electron-vite's `?modulePath` import and the dependency-cruiser collision hypothesis became spike 1.
- Research finding 8 (push): the `ipcEvents` sibling map, the preload disposer, and `setQueryData` over invalidation all land as designed here.
- Research finding 9 (defects): the duplicate-slug overwrite, the Windows device names, and the version question each get a decision below.
- Acceptance references, sections 1 through 3: the error listener before `listen`, the close-then-drain stop order, and the dual-family bind become listener behaviors with tests.
- Acceptance references, section 5: the two refusal envelopes and the 404 status carry into the engine's route table.
- Acceptance references, AC-32 and AC-33: the packaged-asar fork check and the no-orphan-on-quit rule enter the risks and the end-to-end verification.
- Acceptance references, AC-9 through AC-12: consulted and overruled. The locked port decision removed path routing, so no normalization or prefix-regression machinery lands.
- `discovery/candidate-approaches.md`: the converged module split, the resident child, and the snapshot-versus-code disagreement resolutions enter the Decisions section as settled.
- `discovery/design-references.md`: the Mobbin rows for the Dub-style inline conflict message and the Relevance-style paired state carrier back the sheet and sidebar shapes the proposal locked.
- `discovery/rider-ledger.md`: the ledger is empty. The `--color-success` residue from rider #90 becomes the `--color-running` token work, and rider #92's fix means `settings-newer-schema` already exists.

## Goals and non-goals

**Goals:**

- A person creates a gateway from the empty state, and the gateway serves the moment it saves.
- Each gateway answers at the root of its own loopback port, with a health answer and two dialect refusals a client SDK can parse.
- Per-gateway state reaches the sidebar, the toolbar, and the menu bar through one push surface, and start and stop reach one gateway alone.
- The contracts package carries every new shape: the port field, the tightened slug rule, the state union, five new channels, the event map, and the child protocol.
- The settings screen loses the port, and its server rows stop claiming to wait on an engine that now exists.
- The story suite runs every story in both schemes and proves the requested scheme applied.

**Non-goals:**

- No canvas gateway node. The canvas keeps its placeholder.
- No gateway editing. Name, slug, and port can't change after creation, and the move-to-a-free-port offer is the only stored-document mutation after save.
- No provider traffic, no streaming, no request logging, and no `requireGatewayToken` enforcement. The token deferral rides in the engine ADR by name.
- No autostart at launch. The settings row stays inert and names the launch-time start it waits for.
- No liveness and readiness split on the health path.
- No "Read the guide" button, no shortcut hint under the call to action, and no bottom status bar.

## Constraints and invariants

- TypeScript runs at maximum strictness: `strict: true` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, and `noPropertyAccessFromIndexSignature`.
- No `any`, no `as` casts to silence errors, and no `@ts-ignore` or `@ts-expect-error` without a comment explaining why.
- Never write code comments. Code explains itself through naming and structure. The sole exception is a constraint the code can't express.
- Feature-Sliced Design (FSD) v2.1 governs every renderer file. Every slice exports through its `index.ts` public interface, and no slice reaches into another slice's internals.
- The engine boundary rules in `.dependency-cruiser.cjs` bind: `engine-no-electron`, `engine-only-contracts`, and `desktop-not-into-engine`. Any amendment lands as a reviewed diff.
- Every listener binds loopback and nothing else. recompose fronts paid accounts, and a wider bind hands the quota to whoever asks.
- Test-first, always: red, green, refactor. Test code changes if and only if behavior changes. Doubles appear only at real process boundaries.
- Load-bearing derived types get `*.test-d.ts` specs with `expectTypeOf`, run through vitest typecheck.
- A new component under a `ui/` segment ships its `*.stories.tsx` sibling before the branch leaves the machine.
- Anything that reaches the screen gets looked at through `claude-in-chrome`, in both schemes, before it lands.
- Authored markdown passes Vale and cspell. Never use an em dash.
- `main` stays protected. One job, one branch, one pull request.

## Design

### The shape

Five pieces move together, from the inside out.

1. **Contracts** gain the port field, the slug bound, the state union, five channels, the `ipcEvents` map, two error codes, and the child protocol. Everything downstream types against this layer.
2. **The engine package** opens as a pure Hono app per gateway, one socket-touching listener module, and one impure child entry. It imports contracts and nothing else.
3. **Main** grows an engine host that owns one resident utility-process child, a state ledger, a free-port probe, conflict checks on save, lifecycle menus, and the push to every window.
4. **The renderer** opens the `widgets` layer with three slices, adds four kit pieces and three tokens to `shared`, and turns the home surface into the creation path.
5. **The settings surface** sheds the port row and rewords its two inert server rows.

### One request, end to end

The engine composes each gateway's behavior as a pure function over Request and Response. `createGatewayApp` builds one Hono app per gateway. A loopback guard runs first: any request whose `Host` falls outside the loopback set for that gateway's port answers 403, and any request carrying an `Origin` header at all answers 403. No browser has business here, and no command-line client sends an origin.

Behind the guard sit fixed root routes. `GET /health` answers 200 with the gateway's display name. The Anthropic dialect answers on `/v1/messages` and `/messages`. The OpenAI dialect answers on `/v1/chat/completions` and `/chat/completions`. Serving each path with and without the `v1` prefix lets either SDK habit land on a bare origin. While the gateway holds no virtual model, both dialect routes answer 404 with their own vendor envelope, naming the gateway and the missing model. Every other path answers 404 in the Anthropic envelope, the only vendor-published shape. Every refusal carries a JSON content type.

The listener module is the only file that touches sockets. It binds the literal `127.0.0.1` always and opens `::1` alongside it, never the string `localhost`. Node resolves `localhost` in operating-system order since v17, so the literal is the only bind that behaves the same on all three platforms. A machine with no IPv6 loopback degrades to IPv4 alone rather than failing. `EADDRINUSE` on either family closes any sibling listener already open and fails that gateway's start alone. The error listener attaches before `listen`, because Node emits `EADDRINUSE` as an event rather than a throw. Stop runs `close()` first, then `closeAllConnections()`, and resolves only once that gateway's listeners are down.

### The process boundary

Main forks one resident child through electron-vite's `?modulePath` support and keeps it across every start and stop. The child holds a registry of open listeners and nothing else. Main owns storage: the child receives each gateway as data over the message port and never touches a filesystem.

The wire protocol is two schemas in contracts. A directive travels parent to child: `start` carries the slug, the display name, and the port, and `stop` carries the slug. A report travels child to parent: `state` carries the slug and the per-gateway state union. Both sides parse with the schema at the boundary, matching ADR-0018's symmetric-validation stance. Start on a running slug and stop on a stopped slug are no-ops that re-report the current state, so retries can't corrupt anything.

Main's engine host folds reports into a ledger, one state per slug, initialized all-stopped from the stored list at boot. Every ledger change pushes the whole snapshot: to every window over the `engine:state` event, and to the tray, which rebuilds its context menu so the submenu follows state without reopening. A child that exits on its own folds every slug to stopped and pushes the snapshot, and the next start directive spawns a fresh child. Quit kills the child before the app exits, so no orphan holds a port.

### The save that serves

```
sheet                 main                       engine child            windows
  |                     |                            |                     |
  |-- gateways:save --->|                            |                     |
  |                     |-- slug and port checks     |                     |
  |                     |-- write slug.json          |                     |
  |<-- ok: list --------|                            |                     |
  |                     |-- directive: start ------->|                     |
  |                     |                            |-- bind 127.0.0.1    |
  |                     |                            |-- bind ::1          |
  |                     |<-- report: state ----------|                     |
  |                     |-- push engine:state snapshot ------------------->|
```

The sheet closes on a successful save, and the outcome of the start arrives by push. A gateway whose port another process took between the offer and the save stores anyway. Its report reads `{ status: 'stopped', failure: { port } }`, the sidebar shows the stopped shape, and the error line names the port.

The sheet's port field arrives filled by `gateways:offer-port`. Main binds loopback port 0, reads the port the operating system assigned, and closes the probe. While the answer collides with a stored gateway's port, main probes again under a bounded attempt count.

### The renderer

The `widgets` layer opens with three slices. `gateway-sidebar` renders the "Local Gateways" group, one row per stored gateway with a trailing status indicator, and the "New Gateway…" row. `gateway-toolbar` renders the start and stop control, the monospace address pill with its copy button, and the failed-start line on its own row. `gateway-create` renders the creation sheet on the new `Sheet` primitive with its live "Serves at" preview.

The root layout owns the toolbar container, replacing the bare drag strip, and renders the sidebar widget under the static links. The toolbar cluster carries `app-no-drag` and renders while a gateway route is active. The creation sheet mounts once in the root layout and opens from a root-level `create` search param. The empty-state call to action, the sidebar row, and the application menu all drive the same param. The menu path reuses the shipped settings-shortcut navigation with a press count. The View menu's "Show Get Started" item drives a `getStarted` param the same way, which clears the dismissal key.

Data flows through TanStack Query. `gatewaysQueryOptions` and `engineStatesQueryOptions` live in `shared/api`, because pages and widgets both read them and neither layer may import the other's slices. The route loaders warm both. The `engine:state` push writes into the cache through `setQueryData` on the engine-states key, and the gateway list stays untouched. The subscription binds once at app setup through the preload disposer, so no listener leaks across route changes.

The home surface shows the ghost graph, the heading, the body copy, and the call to action while no gateway exists. Once one exists, home shows a plain surface with the get-started card until the person dismisses it. The card derives its step state from stored documents: a gateway exists, an account exists, and the two waiting steps name what they wait for. Dismissal persists in `localStorage` under a named renderer key, because coaching chrome isn't domain data.

### What the settings surface sheds

`EnginePortRow` retires with its browser test and stories, and `enginePort` leaves the schema. The bind address row becomes a static value row reading `127.0.0.1` with the description "Fixed at loopback. recompose never serves the network." The autostart row stays inert and its reason becomes "Waits on launch-time start." The log-retention row keeps naming the engine, because request logging still doesn't exist.

### Trade-offs in view

The design carries two failure vocabularies on one IPC surface, and carries them on purpose. A conflict at save crosses as `ok: false` with a code, like every other expected failure. A failed start rides inside the state union as `ok: true`, because the indicator, the error line, and the push must read one value that can never disagree with itself. The Decisions section records the full argument.

The design also accepts a per-gateway process cost it doesn't pay: listeners multiply, the child doesn't. One resident child holds every listener, so N gateways cost N sockets and one process.

## Data model and contracts

### The gateway document, version 1

`packages/contracts/src/gateway-config.ts` changes in place, and the version stays 1.

```ts
export const GATEWAY_PORT_RANGE = { min: 1024, max: 65535 } as const;

export const gatewayPortSchema = z.int().min(GATEWAY_PORT_RANGE.min).max(GATEWAY_PORT_RANGE.max);

const WINDOWS_DEVICE_NAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
]);

export const gatewaySlugSchema = z
  .string()
  .max(63, 'at most 63 characters')
  .regex(/^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9]))*$/, 'lowercase slug with single dashes')
  .refine((slug) => !WINDOWS_DEVICE_NAMES.has(slug), 'Windows reserves this name');
```

`gatewayConfigSchema` drops `.min(1)` from `virtualModels` and gains `port: gatewayPortSchema`. The range constant moves here from `packages/contracts/src/settings.ts` and takes the name `GATEWAY_PORT_RANGE`, because it now bounds a gateway's field rather than an app setting. The regex admits lowercase only, so the lowercase device-name set needs no case folding. The 63-character bound is the Domain Name System (DNS) label bound: the slug stays a safe filename and a safe hostname label everywhere.

### The per-gateway engine state union

One shape serves the invoke responses, the push payload, and the child's reports, in `packages/contracts/src/engine-state.ts`.

```ts
export const gatewayEngineStateSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('running') }),
  z.strictObject({
    status: z.literal('stopped'),
    failure: z.strictObject({ port: gatewayPortSchema }).optional(),
  }),
]);

export type GatewayEngineState = z.infer<typeof gatewayEngineStateSchema>;

export const engineStatesSchema = z.record(gatewaySlugSchema, gatewayEngineStateSchema);

export type EngineStates = z.infer<typeof engineStatesSchema>;
```

Running carries nothing extra, because the stored document already holds the port the address renders. A failed start is `{ status: 'stopped', failure: { port } }`: the indicator reads the status, and the error line reads the failure.

### The channel registry

`ipcChannels` grows from twelve entries to seventeen. `IpcChannel`, `IpcRequest`, `IpcResponse`, and `RecomposeIpc` all derive from the map, so the type surface follows.

| Channel               | Request                    | Response                                  |
| --------------------- | -------------------------- | ----------------------------------------- |
| `gateways:offer-port` | `z.void()`                 | `ipcResult(gatewayPortSchema)`            |
| `gateways:move-port`  | `z.strictObject({ slug })` | `ipcResult(z.array(gatewayConfigSchema))` |
| `engine:start`        | `z.strictObject({ slug })` | `ipcResult(gatewayEngineStateSchema)`     |
| `engine:stop`         | `z.strictObject({ slug })` | `ipcResult(gatewayEngineStateSchema)`     |
| `engine:states`       | `z.void()`                 | `ipcResult(engineStatesSchema)`           |

The twelve existing channels keep their shapes. `gateways:save` keeps its request and response and gains the two conflict checks behind it. `engine:states` exists so the first paint reads truth instead of racing the first push. `gateways:move-port` composes the whole recovery in main: offer a free port, rewrite the stored document, start the gateway, and answer the updated list. Composing it in main keeps the renderer's stale list out of a port decision.

### The event map

The lifecycle push gets its own map beside `ipcChannels` in `packages/contracts/src/ipc.ts`. Folding it into `ipcChannels` would break the request-to-response shape of `RecomposeIpc`.

```ts
export const ipcEvents = {
  'engine:state': { payload: engineStatesSchema },
} as const;

export type IpcEvent = keyof typeof ipcEvents;
export type IpcEventPayload<Event extends IpcEvent> = z.infer<(typeof ipcEvents)[Event]['payload']>;

export type RecomposeIpcEvents = {
  [Event in IpcEvent]: (listener: (payload: IpcEventPayload<Event>) => void) => () => void;
};
```

The payload is the whole snapshot rather than a delta. A subscriber that misses one push heals on the next, and no ordering rule exists to get wrong. Preload exposes a second frozen global, `recomposeEvents`, typed `RecomposeIpcEvents`. Each entry wraps the callback in its own handler, so `ipcRenderer` never leaks through `event.sender`, and returns a disposer that unregisters exactly that handler. `apps/desktop/src/preload/index.d.ts` declares both globals.

### The child protocol

`packages/contracts/src/engine-protocol.ts` carries the wire shapes both processes parse.

```ts
export const engineGatewaySchema = z.strictObject({
  slug: gatewaySlugSchema,
  displayName: z.string().trim().min(1),
  port: gatewayPortSchema,
});

export const engineDirectiveSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('start'), gateway: engineGatewaySchema }),
  z.strictObject({ kind: z.literal('stop'), slug: gatewaySlugSchema }),
]);

export const engineReportSchema = z.strictObject({
  kind: z.literal('state'),
  slug: gatewaySlugSchema,
  state: gatewayEngineStateSchema,
});
```

`engineGatewaySchema` carries only what the engine consumes today. Virtual models join the shape when a provider connects, not before.

### Error codes

`ipcErrorSchema` grows from seven codes to nine: `slug-conflict` and `port-conflict` join the closed set. The `port-conflict` message is load-bearing: main appends "already holds this port." to the holder's slug. The renderer prints the message verbatim, because only main knows the true holder.

### The type-level specs

`packages/contracts/src/ipc.test-d.ts` moves with the surface. The channel-totality assertion, `keyof RecomposeIpc` equals `IpcChannel`, now covers seventeen members. A sibling assertion pins the event surface: `keyof RecomposeIpcEvents` equals `IpcEvent`. The closed error-code assertion grows to nine members. New assertions pin the state union: `failure` exists only on the stopped arm, and `GatewayEngineState` never carries a fourth status. `packages/contracts/src/settings.test-d.ts` asserts that `Settings` has no `enginePort` property, turning the retirement into a compile-time fact.

### Storage contracts

Gateway documents stay one JSON file per slug under the gateways directory. `gateways:save` refuses an existing slug with `slug-conflict` and refuses a stored port with `port-conflict` before writing, so the channel keeps creation-only semantics this round. Editing arrives with the gateway settings feature. The checklist dismissal lives in `localStorage` under `recompose.get-started.dismissed`, renderer-side, outside the settings document.

## Error handling

The surface carries two failure vocabularies, and the split follows one rule. A failure that refuses an act crosses the boundary as `ok: false` with a code. A failure that describes a gateway's condition rides inside the state union, because the indicator, the error line, and the push must read one value. The proposal locked the split, and this document records the cost rather than hiding it: a reader meets both shapes on one surface.

| Failure                                                   | Representation                                                     | The screen shows                                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| A slug a stored gateway holds                             | `ok: false`, `slug-conflict`                                       | the sheet stays open, and the slug field reads "Another gateway holds this slug."           |
| A port a stored gateway holds                             | `ok: false`, `port-conflict`                                       | the sheet stays open, and the port field prints the message naming the holder               |
| A slug the format rejects                                 | never crosses                                                      | the sheet blocks the save and reads "Accepts lowercase letters, digits, and single dashes." |
| A Windows device name                                     | never crosses                                                      | the sheet blocks the save and reads "Windows reserves this name."                           |
| A port outside the range                                  | never crosses                                                      | the sheet blocks the save and reads "Accepts 1024 through 65535."                           |
| Another process holds the port at start                   | state union, `{ status: 'stopped', failure: { port } }`            | the stopped shape, plus "Another process holds port 8397." beside "Move to a free port"     |
| Another process takes the port between offer and save     | same as above, after a successful save                             | the gateway stores, shows stopped, and the line names the port                              |
| `::1` refuses the bind on a machine without IPv6 loopback | no failure at all                                                  | nothing, the gateway runs on IPv4 alone                                                     |
| `EADDRINUSE` on either family                             | state union, `failure: { port }`                                   | the failed-start line, because half a bind is a failed start                                |
| The engine child dies                                     | state union, every slug folds to `stopped`                         | every indicator shows stopped, and the next start spawns a fresh child                      |
| The child won't spawn, or a directive times out           | `ok: false`, `storage-failed`, message naming the engine operation | the toolbar's mutation error state                                                          |
| The free-port probe fails                                 | `ok: false`, `storage-failed`, message naming the probe            | the port field arrives empty, and the range message stands in                               |
| A settings document from a newer build                    | `ok: false`, `settings-newer-schema`, already shipped              | the settings surface reports it, and gateway creation no longer reads settings at all       |
| A gateway document write fails                            | `ok: false`, `storage-failed`                                      | the sheet reports the save didn't land                                                      |

Three rules bind the handlers. No silent failures: the child logs and ignores a directive that fails its parse, and main logs a child exit before folding the ledger, so nothing disappears without a trace. Errors carry context: every message names the gateway, the port, or the operation. Expected failures travel as typed values: nothing on this surface throws across the bridge except the sender-trust rejection ADR-0018 already carved out.

Two entries above reuse `storage-failed` rather than minting codes. The proposal locked exactly two new codes, the renderer has no distinct branch for a probe or spawn failure, and the message carries the operation. A dedicated code would add a branch nothing reads.

The `role="alert"` line for a failed start inserts a fresh node per attempt, because an alert node re-rendering the same string announces nothing the second time. The line clears when its gateway starts, when the person accepts the move, or when a new attempt begins.

## File map

### Contracts

- `packages/contracts/src/gateway-config.ts`: the port field, the range constant, the slug bound, and the device-name refusal (modify)
- `packages/contracts/src/gateway-config.test.ts`: empty `virtualModels`, port bounds, slug refusals, and the arbitrary moves with all three (modify)
- `packages/contracts/src/engine-state.ts`: the per-gateway state union and the snapshot record (create)
- `packages/contracts/src/engine-state.test.ts`: union parse behavior and strictness (create)
- `packages/contracts/src/engine-protocol.ts`: the directive and report schemas (create)
- `packages/contracts/src/engine-protocol.test.ts`: protocol parse behavior (create)
- `packages/contracts/src/ipc.ts`: five channels, the `ipcEvents` map, its derived types, and two error codes (modify)
- `packages/contracts/src/ipc.test.ts`: the roster moves to seventeen, plus event-map coverage (modify)
- `packages/contracts/src/ipc.test-d.ts`: totality over seventeen channels, the event map, nine codes, and the union arms (modify)
- `packages/contracts/src/settings.ts`: `enginePort` and `ENGINE_PORT_RANGE` leave, version stays 2 (modify)
- `packages/contracts/src/settings.test.ts`: the port assertions leave (modify)
- `packages/contracts/src/settings.test-d.ts`: asserts the absence of `enginePort` (modify)
- `packages/contracts/src/index.ts`: re-exports the two new modules (modify)

### Engine package

- `packages/engine/package.json`: `@recompose/engine`, exports `.` and `./child`, dependencies Hono, `@hono/node-server`, and `@recompose/contracts` (create)
- `packages/engine/src/loopback-guard.ts`: the Host and Origin refusals (create)
- `packages/engine/src/refusals.ts`: the Anthropic and OpenAI envelope builders (create)
- `packages/engine/src/gateway-app.ts`: `createGatewayApp`, the guard, the health route, and the four dialect routes (create)
- `packages/engine/src/gateway-listener.ts`: the only socket-touching module, dual-family bind, close-then-drain stop (create)
- `packages/engine/src/engine-runtime.ts`: the listener registry over an injected listener factory, idempotent start and stop (create)
- `packages/engine/src/parent-port.ts`: the minimal local type for the utility-process port, so no Electron type imports exist (create)
- `packages/engine/src/child.ts`: the impure entry, parses directives, drives the runtime, posts reports (create)
- `packages/engine/src/*.test.ts`: behavior specs per module, socket-free except the listener spec (create)
- `packages/engine/vitest.config.ts`, `packages/engine/vitest.mutation.config.ts`, `packages/engine/stryker.config.json`, `packages/engine/tsconfig.json`: the contracts-package pattern, applied (create)

### Main process

- `apps/desktop/src/main/engine-host/engine-host.ts`: the resident child, directive sending, report folding, snapshot subscribers, dispose (create)
- `apps/desktop/src/main/engine-host/engine-host.test.ts`: host behavior against a fake child (create)
- `apps/desktop/src/main/engine-host/engine-state-ledger.ts`: pure fold of reports into the snapshot (create)
- `apps/desktop/src/main/engine-host/engine-state-ledger.test.ts`: the fold spec (create)
- `apps/desktop/src/main/engine-host/spawn-engine.ts`: the `?modulePath` import and the `utilityProcess.fork` call, shell-thin (create)
- `apps/desktop/src/main/engine-host/free-port.ts`: the offer with the stored-port skip over an injected probe (create)
- `apps/desktop/src/main/engine-host/free-port.test.ts`: the skip and bounded-retry spec (create)
- `apps/desktop/src/main/ipc/engine-ipc.ts`: handlers for the five new channels (create)
- `apps/desktop/src/main/ipc/engine-ipc.test.ts`: handler specs against a fake host (create)
- `apps/desktop/src/main/ipc/storage-ipc.ts`: the slug and port conflict checks, and the start-on-save seam (modify)
- `apps/desktop/src/main/ipc/storage-ipc.test.ts`: conflict round trips against a temp directory (modify)
- `apps/desktop/src/main/ipc/storage-context.ts`: the context gains `startGateway` (modify)
- `apps/desktop/src/main/ipc/dispatch.ts`: `ipcChannelNames` gains five entries (modify)
- `apps/desktop/src/main/ipc/dispatch.test.ts`: the totality assertion follows (modify)
- `apps/desktop/src/main/menu/app-menu-template.ts`: a macOS File menu carrying the "New Gateway…" item, the same item elsewhere, and the View menu's "Show Get Started" entry (modify)
- `apps/desktop/src/main/menu/app-menu-template.test.ts`: the template spec (modify)
- `apps/desktop/src/main/menu/app-menu.ts`: binds the two new handlers (modify)
- `apps/desktop/src/main/tray/tray-menu-template.ts`: `TrayMenuItem` grows submenu, icon, and enabled, and the template takes gateways plus states (modify)
- `apps/desktop/src/main/tray/tray-menu-template.test.ts`: submenu shape per state (modify)
- `apps/desktop/src/main/tray/menu-bar-tray.ts`: rebuilds the context menu on snapshot and list changes (modify)
- `apps/desktop/src/main/windows/main-window.ts`: `openNewGatewaySurface` and `openGetStartedSurface` on the settings-shortcut pattern (modify)
- `apps/desktop/src/main/windows/renderer-url.ts`: the two new route builders (modify)
- `apps/desktop/src/main/windows/renderer-url.test.ts`: their specs (modify)
- `apps/desktop/src/main/windows/permission-policy.ts`: `clipboard-sanitized-write` becomes the single allowed permission (modify)
- `apps/desktop/src/main/windows/permission-policy.test.ts`: the allow and the deny-everything-else spec (modify)
- `apps/desktop/src/main/index.ts`: wires the host, the push to windows, the tray rebuild, the menu handlers, and dispose on quit (modify)
- `apps/desktop/src/preload/index.ts`: five bridge entries and the frozen `recomposeEvents` global (modify)
- `apps/desktop/src/preload/index.d.ts`: declares both globals (modify)
- `apps/desktop/resources/`: start, stop, and restart template images with `@2x` variants (create)
- `apps/desktop/package.json`: the `@recompose/engine` workspace devDependency the fork import needs (modify)

### Renderer, shared

- `apps/desktop/src/renderer/src/shared/ui/sheet.tsx`: the Base UI dialog primitive with `initialFocus`, the scrim, and the elevation (create)
- `apps/desktop/src/renderer/src/shared/ui/status-indicator.tsx`: filled dot for running, hollow ring for stopped, state word as accessible name (create)
- `apps/desktop/src/renderer/src/shared/ui/copy-button.tsx`: the icon-only copy affordance with the check swap and the `role="status"` announcement (create)
- `apps/desktop/src/renderer/src/shared/ui/*.stories.tsx`: one story sibling per new component (create)
- `apps/desktop/src/renderer/src/shared/ui/index.ts`: exports the three (modify)
- `apps/desktop/src/renderer/src/shared/api/gateways.ts`: `gatewaysQueryOptions`, the save mutation, the offer, and the move (create)
- `apps/desktop/src/renderer/src/shared/api/engine.ts`: `engineStatesQueryOptions`, start and stop mutations, and the push-to-cache binder (create)
- `apps/desktop/src/renderer/src/shared/api/index.ts`: the segment exports (modify)
- `apps/desktop/src/renderer/src/shared/testing/fake-bridge.ts`: gateway and engine-state seeds, the five new stubs, and a fake `recomposeEvents` with a story-reachable emitter (modify)
- `apps/desktop/src/renderer/src/app/styles/theme.css`: `--color-running`, `--color-scrim`, `--shadow-raised`, and the `push-button-primary` utility (modify)
- `apps/desktop/src/renderer/src/app/styles/primitives.css`: `--green-700: #1a9e33` and the two scrim alpha primitives (modify)

### Renderer, widgets and pages

- `apps/desktop/src/renderer/src/widgets/gateway-sidebar/`: `index.ts`, `ui/gateway-sidebar.tsx`, and its stories (create)
- `apps/desktop/src/renderer/src/widgets/gateway-toolbar/`: `index.ts`, `ui/gateway-toolbar.tsx`, `ui/failed-start-line.tsx`, and their stories (create)
- `apps/desktop/src/renderer/src/widgets/gateway-create/`: `index.ts`, `ui/create-gateway-sheet.tsx`, its stories, and `lib/` for the field-message derivations (create)
- `apps/desktop/src/renderer/src/pages/home/ui/empty-state.tsx`: the ghost graph, the heading, the body copy, and the call to action (modify)
- `apps/desktop/src/renderer/src/pages/home/ui/ghost-graph.tsx`: the `aria-hidden` inline SVG (create)
- `apps/desktop/src/renderer/src/pages/home/ui/get-started-card.tsx`: the checklist card with derived step state and the dismissal (create)
- `apps/desktop/src/renderer/src/pages/home/ui/*.stories.tsx`: story siblings for the three (create and modify)
- `apps/desktop/src/renderer/src/pages/home/index.ts`: the slice exports (modify)
- `apps/desktop/src/renderer/src/app/routes/__root.tsx`: the toolbar container, the sidebar widget, the sheet mount, and the search params (modify)
- `apps/desktop/src/renderer/src/app/routes/index.tsx`: the loader warms gateways and states, and the page branches on emptiness (modify)

### Settings retirement

- `apps/desktop/src/renderer/src/pages/settings/ui/engine-port-row.tsx`, its browser test, and its stories (delete)
- `apps/desktop/src/renderer/src/pages/settings/ui/server-section.tsx`: the port row leaves, the bind address becomes a static value row, the autostart reason changes (modify)
- `apps/desktop/src/renderer/src/pages/settings/ui/server-section.stories.tsx`: follows (modify)
- `apps/desktop/e2e/features/settings/gateway-port.feature`: retires with its steps (delete)
- `apps/desktop/e2e/features/settings/waiting-controls.feature`: the bind-address row leaves the waiting table, and the autostart reason moves (modify)
- `apps/desktop/e2e/steps/settings.steps.ts`: the port steps leave (modify)

### Tests, config, and records

- `apps/desktop/e2e/features/gateways/` and `apps/desktop/e2e/features/engine/`: the approved scenario files, copied from this change's `gherkin/` folder without renaming (create)
- `apps/desktop/e2e/steps/`: their step definitions (create)
- `apps/desktop/e2e/features/home/first-launch.feature`: asserts the new call to action (modify)
- `apps/desktop/e2e/steps/app.steps.ts`: the retiring sentence leaves, the new copy lands (modify)
- `apps/desktop/e2e/visual.spec.ts`: the home-empty gate moves to the new heading (modify)
- `apps/desktop/e2e/visual.spec.ts-snapshots/`: home-empty regenerates on all three platforms (modify)
- `apps/desktop/.storybook/preview.ts`: the scheme decorator reads its default from the Storybook environment and asserts the applied scheme (modify)
- `apps/desktop/.storybook/recompose-bridge.tsx`: the gateway and engine parameters flow through (modify)
- `apps/desktop/vitest.config.ts`: the `storybook-dark` project beside `storybook`, plus coverage excludes for the two shell files (modify)
- `apps/desktop/stryker.config.json`: `spawn-engine.ts` joins the exclude list (modify)
- `.dependency-cruiser.cjs`: the reviewed amendment spike 1 names (modify)
- `knip.json`: the `packages/engine` workspace entry, with `src/child.ts` as an entry point (modify)
- `docs/adr/README.md` and four new ADR files: land at implementation from the drafts below (create)

`pnpm-workspace.yaml` and `turbo.json` need no edit: the `packages/*` glob admits the engine, and the task graph reads its scripts. `lint:boundaries` already scans `apps packages`. `NumericField` stays in the kit: the field-group story still consumes it after its settings consumer retires.

## Interfaces

### Contracts

- Consumes: `zod`, and the existing `nonBlankString` and `ipcResult` helpers.
- Produces:
  - `GATEWAY_PORT_RANGE: { readonly min: 1024; readonly max: 65535 }` and `gatewayPortSchema`
  - `gatewaySlugSchema` with the bound and the refusal, `gatewayConfigSchema` with `port` and an unbounded `virtualModels`
  - `gatewayEngineStateSchema`, `GatewayEngineState`, `engineStatesSchema`, and `EngineStates`
  - `engineGatewaySchema`, `EngineGateway`, `engineDirectiveSchema`, `EngineDirective`, `engineReportSchema`, and `EngineReport`
  - `IpcChannel` widened to seventeen members, `ipcEvents`, `IpcEvent`, `IpcEventPayload`, and `RecomposeIpcEvents`
  - `IpcError['code']` widened to nine members

### Engine package

- Consumes: `@recompose/contracts`, `hono`, and `@hono/node-server`.
- Produces:
  - `createGatewayApp(gateway: EngineGateway): Hono`
  - `openGatewayListeners(app: Hono, port: number): Promise<{ opened: GatewayListeners } | { failed: { port: number } }>`, where `GatewayListeners` is `{ close: () => Promise<void> }`
  - `createEngineRuntime(openListeners: OpenListeners): EngineRuntime`, where `EngineRuntime` is `{ start: (gateway: EngineGateway) => Promise<GatewayEngineState>; stop: (slug: string) => Promise<GatewayEngineState> }`
  - `./child`: the fork entry that wires the runtime to the parent port

### Main, engine host

- Consumes: `EngineDirective`, `EngineReport`, `utilityProcess`, and the `?modulePath` bundle path.
- Produces:
  - `createEngineHost(deps: EngineHostDeps): EngineHost`, where `EngineHost` is `{ start: (gateway: EngineGateway) => Promise<GatewayEngineState>; stop: (slug: string) => Promise<GatewayEngineState>; restart: (gateway: EngineGateway) => Promise<GatewayEngineState>; states: () => EngineStates; onStatesChanged: (listener: (states: EngineStates) => void) => () => void; dispose: () => void }`
  - `foldEngineReport(states: EngineStates, report: EngineReport): EngineStates` and `allStopped(slugs: readonly string[]): EngineStates`
  - `offerFreePort(taken: ReadonlySet<number>, probe: () => Promise<number>, attempts?: number): Promise<number>`
  - `createEngineIpcHandlers(deps): Pick<IpcHandlers, 'engine:start' | 'engine:stop' | 'engine:states' | 'gateways:offer-port' | 'gateways:move-port'>`

### Renderer

- Consumes: the seventeen-channel bridge on `window.recompose`, the event surface on `window.recomposeEvents`, `unwrapIpcResult`, and the shared kit.
- Produces:
  - `shared/api`: `gatewaysQueryOptions`, `engineStatesQueryOptions`, `useSaveGateway()`, `useStartGateway()`, `useStopGateway()`, `useMoveGatewayPort()`, `fetchOfferedPort()`, and `bindEngineStatesToCache(queryClient): () => void`
  - `shared/ui`: `Sheet({ open, onOpenChange, title, description, initialFocus, footer, children })`, `StatusIndicator({ status })`, and `CopyButton({ value, label })`
  - `widgets/gateway-sidebar`: `GatewaySidebar()`
  - `widgets/gateway-toolbar`: `GatewayToolbar({ slug })`
  - `widgets/gateway-create`: `CreateGatewaySheet({ open, onOpenChange })`

## Decisions

The first four decisions meet the ADR bar, and their full drafts ride inline. The files land under `docs/adr/` at implementation, numbered against whatever has merged by then.

### 1. Each gateway owns its own loopback port

**Context.** ADR-0005 put every gateway behind one port, selected by the first path segment. That left per-gateway start and stop at routing level, left the status dot mirroring one engine state, and forced a reserved-slug list. The base-URL research found the deeper cost: naive client concatenation breaks path-prefixed bases in documented ways, and the two dialects disagree about where `/v1` belongs.

**Decision.** Each gateway binds its own loopback port and answers at the root of its address. The stored document carries the port at version 1. First-segment routing, path normalization, dialect-by-suffix guessing, and the reserved-slug list all leave with the shared port.

**Alternatives.** One shared port with path routing, rejected because a taken port killed every gateway at once and the copied address broke under SDK base-URL concatenation. One process per gateway, rejected because listeners isolate failure well enough and processes multiply memory for nothing.

**Consequences.** **Good**: a taken port fails one gateway alone. The copied address is a bare origin that survives every SDK's concatenation. No naming rule can ever invalidate a stored document. The engine never repairs a path or answers a redirect. **Bad**: N gateways cost N ports, and each start can meet its own squatter. The creation sheet must offer a free port, and the failed-start recovery becomes load-bearing.

### 2. The engine serves over Hono

**Context.** ADR-0002 judged Node's `http` sufficient at loopback scale. The repository's testing rules then hardened: behavior specs must run state-based with doubles only at real process boundaries, and node-side logic faces a mutation gate. Hand-rolled routing multiplies exactly the branches those gates punish.

**Decision.** `packages/engine` serves each gateway through a Hono app and opens sockets through `@hono/node-server`. Hono's `app.request()` runs every routing, guard, and refusal behavior against a real Request with no socket, so only the listener module ever binds one. The adapter returns a real Node server, keeping `close()`, `closeAllConnections()`, and the `error` event. Both packages carry a license on the repository's allowlist, and Hono ships zero runtime dependencies. Throughput isn't a reason, and benchmarks appear nowhere in this record. `requireGatewayToken` stays unread this round as a named deferral: the switch exists in settings, the vault holds the token, and the engine ignores both until the token feature wires them.

**Alternatives.** Raw `node:http`, rejected because it hand-rolls routing and loses the port-free test path. Fastify, rejected on fifteen runtime dependencies inside the isolation package. Express, rejected the same way with an older architecture.

**Consequences.** **Good**: every refusal and guard behavior is a pure function over Request and Response, testable at unit speed and mutation-gate depth. The dependency surface stays two allowlisted packages. **Bad**: the isolation package now holds outside dependencies, and the adapter's streaming behavior under Node lacks first-party documentation. A spike precedes any streaming promise in a later change.

### 3. Lifecycle state pushes over a typed event map

**Context.** ADR-0018 shipped an invoke-only surface and recorded the residual in its own words: push-style updates remain unsolved until the engine lands. The engine now lands, and per-gateway state must reach the sidebar, the toolbar, and the tray without polling.

**Decision.** A second map, `ipcEvents`, sits beside `ipcChannels` in contracts, with derived types mirroring the invoke surface's totality. The one event, `engine:state`, carries the whole per-gateway snapshot rather than a delta, so a missed push heals on the next one. Preload exposes a second frozen global whose entries wrap the callback and return a disposer, so `ipcRenderer` never leaks through `event.sender` and no listener outlives its subscriber. The renderer writes the payload into the TanStack Query cache through `setQueryData` on the engine-states key. An `engine:states` invoke channel serves the first paint, so no surface renders a guess while waiting for the first push.

**Alternatives.** Folding push channels into `ipcChannels`, rejected because it breaks the request-to-response shape `RecomposeIpc` derives from. Polling a status channel, rejected because it trades latency for timer noise on a surface the push serves exactly. Delta events per gateway, rejected because deltas need ordering rules and resync logic a snapshot makes unnecessary. Component state instead of the query cache, rejected because three consumers would each hold their own copy.

**Consequences.** **Good**: the push surface carries compile-time totality like the invoke surface, and the state that arrives by invoke can never disagree with the state that arrives by push. **Bad**: preload now maintains two frozen globals by hand, and every future event pays one map entry, one preload line, and one type assertion.

### 4. The slug rule tightens to a bounded, device-safe identifier

**Context.** `gatewaySlugSchema` accepts any length and accepts `con`, `nul`, and their siblings. The slug names a file on disk, and Windows reserves those device names for any extension. ADR-0005 also flagged reserved route names, a concern the port decision dissolved.

**Decision.** The slug keeps its lowercase single-dash grammar and gains two rules: a 63-character bound and a refusal of the Windows device names. The bound is the DNS label bound, which keeps the slug a safe filename and a safe hostname label everywhere. The rule lives in contracts, so the sheet and main share it by construction. The rule reserves no name: nothing routes by path any longer, so `v1` and `health` are ordinary slugs.

**Alternatives.** Reserving `v1` and `health` anyway, rejected because no path exists for the collision, and an unused reservation is a rule someone must remember to delete. Filesystem-encoding slugs at write time, rejected because escaping hides the constraint instead of stating it. A 255-character bound, rejected because a hostname-label-safe slug costs nothing today and spares a future migration.

**Consequences.** **Good**: a gateway named `con` fails at the sheet with a sentence instead of failing on Windows with a filesystem surprise. One rule serves both enforcement points. **Bad**: the bound and the refusal are new constraints a future import feature must surface, and the device-name list is a Windows fact the code must carry.

### 5. A failed start rides inside the state union

The invoke response and the push payload share one per-gateway shape, and a failed start answers `ok: true` carrying `{ status: 'stopped', failure: { port } }`. The indicator, the error line, and the push all read one value, so no two surfaces can disagree about a gateway's condition. The honest cost stands recorded: every other expected failure crosses as `ok: false` with a code, so this surface carries two failure vocabularies.

**Alternatives considered:** an `engine-port-taken` error code, rejected because the push would still need a state shape, leaving the same fact spelled two ways on one surface.

**ADR draft:** carried inside draft 3, which owns the state surface.

### 6. One resident child, listeners inside it

The engine child survives across start and stop, opening and closing per-gateway listeners in place. Main spawns it again on the next start after an exit and kills it before quit. Main owns storage and posts each gateway as data, so the child stays a pure function of its inbound directives.

**Alternatives considered:** a child per gateway, rejected because processes multiply memory and lifecycle code for isolation the per-port listeners already deliver. The child reading gateway files itself, rejected because main is the single writer and a second reader invites drift.

**ADR draft:** carried inside draft 2, which owns the engine's process shape.

### 7. `gateways:save` stays creation-only, and the recovery is its own channel

The save channel refuses an existing slug with a typed code, which closes today's silent-overwrite defect. The move-to-a-free-port recovery lands as `gateways:move-port`, composed in main: offer, rewrite, start, answer the list. Main composes it because the renderer's list can be stale, and a port decision made against stale data reintroduces the race the offer exists to avoid.

**Alternatives considered:** upsert semantics on `gateways:save`, rejected because editing is a separate feature and an upsert reopens the overwrite hazard. A renderer-composed recovery calling offer then save, rejected because two invokes race other windows and the tray.

**ADR draft:** None. ADR-0018 already governs channel additions, and the drafts above carry the new surface.

### 8. The gateway and engine queries live in `shared/api`

Pages and widgets both read the gateway list and the engine states, and FSD forbids each from importing the other's slices. `shared/api` already exists as the transport segment, and the two modules carry query definitions with no gateway behavior. The entities layer stays closed until a gateway grows renderer-side logic of its own.

**Alternatives considered:** an `entities/gateway` slice, rejected as a layer opened for two query files. Duplicating the queries per consumer, rejected because two cache keys for one fact is how indicators disagree.

**ADR draft:** None. ADR-0010 governs placement, and this follows its start-simple rule.

### 9. The creation sheet is a widget opened by a search param

The sheet mounts once in the root layout and opens from a root-level `create` search param. The empty-state button, the sidebar row, and the menu item all drive the same param, and the menu path reuses the shipped settings-shortcut navigation with a press count. The sheet component lives in `widgets/gateway-create`, because a page slice can't serve the sidebar widget and the menu at once.

**Alternatives considered:** the sheet inside `pages/home`, rejected because opening it from a canvas route would force a surface change first. A dedicated push event for the menu, rejected because navigation already reaches the renderer and a second mechanism would need its own contract.

**ADR draft:** None.

### 10. The renderer copies the address, and the permission policy opens one hole

The address carries no secret, so the copy affordance runs in the renderer, and ADR-0047's vault route stays scoped to secrecy. The deny-by-default permission policy currently blocks `clipboard-sanitized-write`, so `permission-policy.ts` gains exactly that one allow. The policy spec pins that everything else stays denied.

**Alternatives considered:** a copy channel through main, rejected because the locked decision reserves that route for secrets. A channel for public text would widen the main-process surface instead of the narrower permission. `document.execCommand('copy')`, rejected as deprecated machinery adopted to dodge a one-line policy statement.

**ADR draft:** None, though the change note belongs beside ADR-0028's record when the file lands.

### 11. The dark story project drives the scheme from the outside

A `storybook-dark` vitest project lands beside `storybook`, pointing at the same Storybook config while the scheme decorator reads its default from a Storybook environment variable. A preview-level assertion reads the applied scheme from the document and throws on a mismatch, because axe once passed a dark scheme that rendered light.

**Alternatives considered:** a second `.storybook` directory, rejected as a config fork that drifts. Per-story dark variants, rejected because doubling story files scales with authors instead of config.

**ADR draft:** None. ADR-0029 owns the workshop, and this is its configuration.

### 12. The version answer, stated once

`gatewayConfigSchema` stays at version 1 while adding a required field, and `settingsSchema` moves to version 3 while dropping one. The two part company on evidence rather than on principle. The stored gateways directory holds no document, so nothing can fail the new gateway parse. A stored settings document holds the field this change removes, so the removal earns a migration. The Migration and rollout section carries the full argument and the evidence.

**Alternatives considered:** bumping either version, rejected because a migration no document will ever pass through is dead code with a maintenance bill.

**ADR draft:** None. The reasoning rides in the proposal's locked decisions and in this document.

## Test matrix

| Layer          | What this layer proves (or why none)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Check command                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit           | Everything socket-free. Through `app.request()` with no listener: the health answer, both dialect refusals with and without the `v1` prefix, the envelope shapes, the Host and Origin refusals, and the catch-all Anthropic 404. In contracts: the slug bound and device-name refusals, the port bounds, the state union, the protocol schemas, and the widened `virtualModels`. In main: the ledger fold, the free-port skip over an injected probe, both menu templates, and the route builders. Type-level specs pin the channel, event, and union types. | `pnpm run test`                                                                                                                                                       |
| Integration    | Everything that genuinely binds or forks. The listener module binds a real dual-family loopback listener on port 0, refuses a second bind with a failure naming the port, degrades to IPv4 when `::1` is unavailable, and reopens the same port right after close. The storage handlers refuse a duplicate slug and a duplicate port against a real temp directory, and the refused file stays byte-identical. The engine host folds reports from a scripted fake child, including a child exit. Dispatch registers all seventeen channels.                  | `pnpm run test`                                                                                                                                                       |
| End-to-end     | In the real Electron shell with the real child: creating a gateway from the empty state stores it, the sidebar row appears running, and the health path answers over a real socket. Stop from the toolbar stops that gateway alone. A squatted port shows the stopped shape, the line naming the port, and the move offer, and accepting the move serves. A model request answers the typed refusal. The settings Server group offers no port. The compiled gateway and engine features run through the existing features glob.                              | `pnpm run test:e2e` and `pnpm --filter @recompose/desktop run test:e2e:visual`                                                                                        |
| Property       | Every slug the grammar accepts survives the bound, and no device name passes in any position of the accepted set. Every integer inside the port range parses and every integer outside rejects. Any report sequence folded through the ledger leaves exactly the last state per slug. The free-port offer never answers a port in the taken set, for any taken set and any probe sequence. Any valid config with any `virtualModels` length round-trips through serialize and parse.                                                                         | `pnpm run test`                                                                                                                                                       |
| Mutation scope | Three configs, diff-scoped from the pull-request base. Contracts covers every changed file under `packages/contracts/src` at break 77. The new engine config covers `packages/engine/src` minus `child.ts` at break 80. Desktop main covers the engine host, the handlers, the templates, and the policies at break 81, with `spawn-engine.ts` joining the existing shell excludes. No surviving mutant gets silenced by a threshold edit.                                                                                                                   | `pnpm --filter @recompose/contracts run test:mutation`, `pnpm --filter @recompose/engine run test:mutation`, and `pnpm --filter @recompose/desktop run test:mutation` |

### Designated mutant killers

Property tests pin invariants across a range, and example tests pin the boundaries the generators miss. The mutation gate leans on the pair.

| Invariant                                     | Mutant killer                                                                          |
| --------------------------------------------- | -------------------------------------------------------------------------------------- |
| The slug bound sits exactly at 63             | boundary examples at 63 and 64 beside the grammar property in `gateway-config.test.ts` |
| The port range is exactly 1024 through 65535  | boundary examples beside the range property in `gateway-config.test.ts`                |
| The ledger keeps the last report per slug     | the fold property plus an interleaving example in `engine-state-ledger.test.ts`        |
| The offer never returns a taken port          | the skip property plus an exhausted-attempts example in `free-port.test.ts`            |
| A refused save changes nothing on disk        | the byte-identical example in `storage-ipc.test.ts`                                    |
| A refusal names the gateway in both envelopes | envelope examples per dialect in the engine's refusal specs                            |

### The scheme assertion

The `storybook` and `storybook-dark` projects run every story under axe in their own scheme, and both land in this change. The preview-level assertion reads the applied scheme from the document root and fails the story when the requested scheme didn't apply. That check exists because the suite once passed axe on a dark scheme that rendered light. The status indicator, the pill, and the filled button are the components this change adds whose whole job is carrying state against both backdrops.

## Task decomposition hooks

The contracts cluster lands alone first, per the locked decision. After it, clusters run in parallel unless one of three blockers holds: a cluster reads what another produces, two clusters own the same file, or one inspects what another writes. Every dispatch names its files and states that the others run on disjoint files.

- **Task 1: contracts, spikes, and the settings retirement.** (depends on: none, hands off: the widened contracts surface) Owns everything under `packages/contracts/src/`, the settings-page files the `enginePort` removal breaks, `apps/desktop/e2e/features/settings/`, the settings steps, and `.dependency-cruiser.cjs`. Opens with the two spikes. Spike 1 runs `pnpm run lint:boundaries` against a probe `?modulePath` import and names which rule fires, and the reviewed amendment lands here. Spike 2 forks a throwaway `@hono/node-server` bundle under a real Electron utility process and proves a loopback answer, discarding the probe code. The retirement rides here because removing `enginePort` breaks its consumers, and no commit may land red.
- **Task 2: the engine package.** (depends on: task 1, reads its schemas, hands off: `@recompose/engine` with the `./child` entry) Owns everything under `packages/engine/` and the `knip.json` workspace entry. Runs beside tasks 3 and 5 on disjoint files.
- **Task 3: the kit, the tokens, and the dark project.** (depends on: task 1 only for ordering, hands off: `Sheet`, `StatusIndicator`, `CopyButton`, the three tokens, the primary utility, and the `storybook-dark` project) Owns the three new `shared/ui` components with stories, both style files, `apps/desktop/.storybook/preview.ts`, and `apps/desktop/vitest.config.ts`. Runs beside tasks 2 and 5.
- **Task 4: the main process.** (depends on: task 2, because the fork imports the child entry it produces, and on task 3 for `apps/desktop/vitest.config.ts`, a shared-file blocker resolved by task 3 landing first) Owns `apps/desktop/src/main/` outside the settings files task 1 touched, both preload files, the resources, `apps/desktop/package.json`, and `apps/desktop/stryker.config.json`.
- **Task 5: widgets, pages, and the fake bridge.** (depends on: task 1 for types and task 3 for kit components, hands off: the three widget slices and the reworked home surface) Owns everything under `widgets/`, `pages/home/`, `shared/api/`, `shared/testing/fake-bridge.ts`, `.storybook/recompose-bridge.tsx`, and the two route files. Runs beside task 4 on disjoint files.
- **Task 6: acceptance, visual, and records.** (depends on: tasks 4 and 5, because it inspects the running app they produce, hands off: the merged branch evidence) Owns everything under `apps/desktop/e2e/` outside task 1's settings retirement, and the four ADR files with the index.

The genuine blockers, named: task 2 reads task 1's schemas. Task 4 reads task 2's child entry and shares one file with task 3. Task 5 reads task 1's types and task 3's components. Task 6 inspects what tasks 4 and 5 produce. Every other pair runs in parallel.

## Risks

- [Risk] The `?modulePath` import fails to resolve for a workspace package specifier → Mitigation: spike 1 answers it first, and the fallback is a one-line entry shim in `engine-host/` that the dependency-cruiser amendment sanctions by exact path.
- [Risk] The forked bundle misbehaves inside the asar the fuses require → Mitigation: spike 2 proves the fork path early, and the packaged smoke test runs against a real build artifact before the change ships.
- [Risk] A malicious page reaches a loopback listener through DNS rebinding → Mitigation: the Host guard rejects any name outside the loopback set, and any request carrying an `Origin` answers 403, matching the CVE-2024-28224 and CVE-2025-66414 remedies.
- [Risk] `localhost` resolves to the unbound family on one platform and reads as "the engine is down" → Mitigation: the listener binds both loopback literals, and the integration spec exercises each family.
- [Risk] The permission-policy opening for `clipboard-sanitized-write` widens beyond intent → Mitigation: the policy spec pins the single allow and asserts every other permission still denies.
- [Risk] A stale renderer list lets a conflicting save through → Mitigation: both conflict checks run in main against the directory, and the refused-save spec asserts the stored file stays byte-identical.
- [Risk] The engine child dies and every gateway reads stopped with no cause → Mitigation: main logs the exit with its code before folding the ledger, and the next start spawns a fresh child.
- [Risk] The two failure vocabularies confuse a future contributor into adding a third → Mitigation: the Error handling section states the split's rule, and draft 3 records it where channel authors look.
- [Risk] The tray rebuild races a burst of state pushes → Mitigation: rebuilds read the ledger snapshot rather than the event, so the last rebuild always reflects the last state.
- [Risk] A `role="alert"` line re-announces nothing on a repeated failure → Mitigation: every attempt inserts a fresh alert node, and the widget spec asserts the node identity changes.
- [Risk] The dark project passes while rendering light → Mitigation: the scheme assertion fails any story whose applied scheme mismatches the requested one.
- [Risk] The e2e squatted-port scenario flakes when the squatter binds one family → Mitigation: the fixture binds both loopback literals before the scenario starts.

## Migration and rollout

**Deploy.** One release carries the whole change, nothing behind a flag. A gateway that can't serve is worse than no gateway button.

**The gateway schema stays at version 1, and here is why that's safe.** The version rules would ordinarily force a bump: `port` is a new required field, so a document written before this change fails the new parse. No such document exists, checked rather than assumed. The gateways directory under `~/Library/Application Support/@recompose/desktop/` stands empty. No release of recompose has shipped, and nothing in the app has ever offered a way to create a gateway. The only writers of gateway files are test fixtures that move inside this same diff. Dropping `.min(1)` from `virtualModels` only widens the accepted set. In the impossible case of a stray pre-change file, the quarantine path already catches a failed parse, sets the document aside, and keeps the list serving.

**The settings schema moves to version 3, and here is why it has to.** Dropping `enginePort` from a `strictObject` means a document still carrying it fails parse. Such a document exists. `~/Library/Application Support/@recompose/desktop/settings.json` holds `schemaVersion: 2` and `enginePort: 8397` today, so a version-free removal would report the maintainer's own settings as unreadable. A gate-1 simplification argued the other way and rested on a check run against the wrong path. The migration from 2 to 3 drops the field, which keeps the retirement invisible to anyone who already ran the app. Every acceptance run still launches against a fresh temporary user-data directory, so the migration matters for real profiles rather than for the suite.

**What retires with the port.** `EnginePortRow` leaves with its browser test and its stories. The accepted scenario "a person enters a port outside the allowed range" leaves the living settings spec through this change's modified delta. The scenario "a person looks for the gateway port" replaces it. The compiled acceptance feature `apps/desktop/e2e/features/settings/gateway-port.feature` retires with its step definitions. The two inert server rows move with `waiting-controls.feature`. The bind-address row becomes a static value row and leaves the waiting table. The autostart reason becomes "Waits on launch-time start."

**Config that must move in step.** `.dependency-cruiser.cjs` gains the reviewed amendment spike 1 names. The expected shape: `not-to-unresolvable` gains a `\?modulePath$` allowance, and `no-orphans` gains an exception for the child entry. `desktop-not-into-engine` gains a single-file exception if the shim form wins. `knip.json` gains the `packages/engine` workspace entry with `src/child.ts` listed as an entry point. `apps/desktop/package.json` gains the `@recompose/engine` workspace devDependency the fork import declares.

**Rollback.** Reverting the branch before release costs nothing: no schema version moved, so a pre-change checkout reads a fresh profile cleanly. A profile that already holds port-carrying gateway documents reads them as quarantined parse failures on the old checkout, which is the shipped corrupt-document behavior and loses no file.

## Open questions

- **Which exact form the fork import takes.** Spike 1 decides between the direct `@recompose/engine/child?modulePath` import and the one-line shim, and the amendment names the matching rule. Both forms live inside task 1's spike and task 4's wiring, so neither changes the specs, the approach, or the task boundaries.
- **Which Storybook environment mechanism carries the dark default.** The decorator can read a `STORYBOOK_`-prefixed variable or a globals override from the vitest project. Both fit inside task 3's files, and the scheme assertion gates the outcome either way.

## End-to-end verification

Run the desktop app from `apps/desktop` with `pnpm dev`, then walk the loop.

1. The home surface shows the ghost graph over the "Create your first gateway" heading, the body copy, and one filled Create Gateway button. The sidebar shows no gateway group.
2. The button opens the sheet with focus in the name field. Typing a name, keeping the offered port, and saving closes the sheet. The sidebar shows the gateway with a filled running dot.
3. `curl http://127.0.0.1:PORT/health` and `curl http://[::1]:PORT/health` both answer 200 with the gateway's name. `curl -X POST http://localhost:PORT/v1/chat/completions` answers 404 with the OpenAI envelope naming the gateway. `/v1/messages` answers the Anthropic envelope.
4. The toolbar shows the address pill reading `http://localhost:PORT` with a dimmed state word, and the copy button puts the bare origin on the clipboard and announces "Address copied."
5. Stop from the toolbar flips the row to the hollow ring, and the curl now refuses to connect. Start brings it back without touching a second gateway created alongside it.
6. Occupy a gateway's port with another process, then start it. The row stays hollow, the line reads "Another process holds port" with the number, and "Move to a free port" restores service on a new port the pill reflects.
7. The menu bar tray lists every gateway with start, stop, and restart, unavailable entries dimmed rather than missing, and the submenu follows a toolbar stop without reopening.
8. CmdOrCtrl+N opens the creation sheet from anywhere. Creating a slug or port a stored gateway holds keeps the sheet open with the conflict sentence under the field.
9. Settings shows no port anywhere, the bind-address row reads `127.0.0.1` as a static value, and the stored `settings.json` holds no `enginePort`.
10. The get-started card tracks the first two steps for real and names what the last two wait for. It hides behind the "Skip setup" footer and returns through the View menu's "Show Get Started" item. Both schemes get the `claude-in-chrome` pass, measuring the running dot and the pill edges from the page.

A fresh-context reviewer diffs the result against these criteria:

- `ipcChannels` holds seventeen entries, `ipcChannelNames` matches, the preload bridge matches, and `ipcEvents` holds one entry with a disposer-returning preload counterpart.
- `gatewayConfigSchema` carries `port` at version 1, `gatewaySlugSchema` carries the bound and the device-name refusal, and `settingsSchema` carries no `enginePort` at version 3.
- `packages/engine` imports only contracts and its two HTTP dependencies, and `pnpm run lint:boundaries` passes with the amended rules.
- Every routing and refusal spec runs through `app.request()`, and only the listener and packaging specs touch a socket.
- The failed start crosses as `ok: true` with the stopped-plus-failure state, and no `engine-port-taken` code exists.
- The three new kit components ship stories, `pnpm run lint:stories` passes, and both storybook projects run with the scheme assertion in place.
- The four ADRs land from the drafts above, and the index carries their rows.
- The retiring copy "Select a gateway or create one to get started." appears nowhere, and the compiled gateway and engine features pass through the features glob.
