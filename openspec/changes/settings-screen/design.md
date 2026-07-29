# Settings-screen design

## Header and change linkage

- Change id: settings-screen
- Schema: recompose
- Proposal: [proposal.md](proposal.md)
- Specs: [specs/settings/spec.md](specs/settings/spec.md)
- Discovery: [discovery/code-map.md](discovery/code-map.md), [discovery/technical-research.md](discovery/technical-research.md), [discovery/acceptance-references.md](discovery/acceptance-references.md), [discovery/design-references.md](discovery/design-references.md), [discovery/rider-ledger.md](discovery/rider-ledger.md)
- Tasks: [tasks.md](tasks.md)

## Context

recompose keeps a settings document on disk and carries it across the process boundary on two channels. No screen reads it. Someone who wants a dark window edits `settings.json` by hand and restarts.

The screen that closes this gap needs controls the renderer doesn't own. `apps/desktop/src/renderer/src/shared/` holds an `api` segment and a `testing` segment, and nothing else. The one field primitive in the repository, `apps/desktop/src/renderer/src/pages/providers/ui/text-field.tsx`, belongs to a single page.

The screen also reaches into the main process on four fronts the app has never touched: the operating system login item, a menu bar tray, `nativeTheme.themeSource`, and `shell.openPath`. Each one needs a channel or a boot-time application step, and every channel entry passes through a hand-maintained list in `apps/desktop/src/main/ipc/dispatch.ts`.

Underneath all that, the settings schema moves from version 1 to version 2. `settingsMigrations` in `packages/contracts/src/settings.ts` is an empty array today, so this change writes the repository's first real migration against an engine no production document has ever exercised.

## Discovery inputs consumed

- `packages/contracts/src/migration.ts`: its loop re-reads the version after each step and never checks for progress, so the guard becomes the first task of the first cluster.
- `packages/contracts/src/settings.ts`: `enginePort` already carries the 1024 to 65535 bounds, so the design lifts them into an exported constant and renders the field copy from it.
- `packages/contracts/src/ipc.ts`: `connectAccountRequestSchema` sits beside the registry, which settles where the two new payload schemas live.
- `packages/contracts/src/ipc.test.ts`: its "exactly the seven specified channels exist" assertion pins the registry, so the design moves that count to twelve rather than deleting the assertion.
- `packages/contracts/src/ipc.test-d.ts`: the existing type-level spec sets the pattern the new channels and the version 2 settings type follow.
- `apps/desktop/src/main/ipc/dispatch.ts`: `ipcChannelNames` is a hand-written literal, so the design adds a totality assertion that ties it to the registry.
- `apps/desktop/src/main/ipc/storage-ipc.ts`: `connectAccount` shows the guard-then-open-then-write vault sequence the token handlers reuse.
- `apps/desktop/src/main/storage/initialize-storage.ts`: its result reaches a caller that throws it away, which is the value the boot-time apply step consumes.
- `apps/desktop/src/main/storage/safe-storage-codec.ts`: `isPlaintextFallback` supplies the plaintext warning the token row shows on Linux.
- `apps/desktop/src/main/index.ts`: its `window-all-closed` handler quits on every platform but macOS, which the tray has to change.
- `apps/desktop/src/main/windows/main-window.ts`: it loads one fixed URL, so the settings shortcut needs a route parameter on the window factory.
- `apps/desktop/src/renderer/src/app/router.tsx`: hash history ran in production only, which left the shortcut landing on the gateways screen under the development server. It's unconditional now, so the main process builds one URL shape.
- `apps/desktop/src/renderer/src/pages/providers/api/accounts.ts`: its query-options plus mutation-with-invalidation shape carries straight into the settings api segment.
- `apps/desktop/src/renderer/src/shared/testing/fake-bridge.ts`: it hardcodes a version 1 settings document, so every story and browser test breaks without a seed parameter and five new stubs.
- `apps/desktop/e2e/visual.spec.ts`: it drives the providers form by role, which is why `AccountKindField` keeps its native select.
- Research finding 1 (headless primitive library): Base UI wins on the number field, so the shared kit and its Architecture Decision Record (ADR) rest on it.
- Research finding 2 (segmented control semantics): the control builds on the radio group primitive, never a toggle group.
- Research finding 3 (number input type): the port field stays a text input with a numeric input mode.
- Research finding 5 (launch at login): Electron covers macOS and Windows only, which the platform-absent row implements.
- Research finding 6 (tray caveats): the tray reference lives at module scope, the quit contract turns conditional, and the tray menu carries an explicit Quit item.
- Research finding 8 (theme): `nativeTheme.themeSource` takes the same three values the schema holds, so no renderer stylesheet changes.
- Research finding 10 (clipboard permission): the deny-by-default permission handler makes the main-process clipboard the route, and the plaintext never crosses the bridge.
- Research finding 11 (inert rows): the four waiting rows keep `aria-disabled`, stay reachable, and name their reason through `aria-describedby`.
- Acceptance-references section 2: the tray gets destroyed on `before-quit`, and its context menu always carries Quit.
- Acceptance-references section 4: the token guard mirrors the `vault-unavailable` precondition, and the plaintext-fallback state reaches the screen.
- Acceptance-references section 7: the migration guard lands before the first step, and the migration round trip earns a property test.
- Acceptance-references section 1, criteria 1 and 2: consulted and overruled. The approved proposal keeps `launchAtLogin` as a stored field and drops the Linux row from the tree, so the brief's "render unavailable on Linux" recommendation loses to the locked decision.
- Design-references gaps 1 through 4: the token row gains an inline two-phase confirmation, keeps the prefix-and-tail mask, offers copy without reveal, and confirms both acts in row-local text.
- Rider ledger: consulted, no impact. The ledger holds zero entries and the lookup ran clean.
- The remaining code-map entries: consulted, no impact beyond confirming file placement.

## Goals and non-goals

**Goals:**

- One scrollable grouped screen presents every stored setting and persists each change with no save action.
- The settings schema reaches version 2 behind a migration engine that refuses a step which fails to advance the version.
- The gateway token lives in the vault, reaches the screen masked, and reaches the clipboard through the main process.
- The renderer gains a shared component layer that later screens inherit rather than repeat.
- Every row whose machinery the repository lacks renders inert and names what it waits for.
- Every failure the design expects arrives as a typed envelope the screen turns into readable row text.

**Non-goals:**

- No toast system and no dialog primitive. Row-local status text and an inline confirmation answer both needs.
- No Linux login item. The row never renders there.
- No bind address, gateway autostart, log retention, or reduced wire motion behavior. Those rows render inert and store nothing.
- No second window and no category rail. The screen lives in the content area of the main window.
- No reveal action for the token. Copy is the only way out of the vault.
- No engine work. The port field stores a number that nothing binds yet.
- No typed downgrade error for a settings document from a future build. That defect predates this change and belongs in the rider ledger.

## Constraints and invariants

- TypeScript runs at maximum strictness: `strict: true`, `noImplicitAny`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noUnusedLocals`, `noUnusedParameters`, `allowUnreachableCode: false`, `allowUnusedLabels: false`, `noUncheckedSideEffectImports`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `forceConsistentCasingInFileNames`, and `isolatedModules`.
- No `any`, no `as` casts to silence errors, and no `@ts-ignore` or `@ts-expect-error` without a comment explaining why.
- Never write code comments. Code explains itself through naming and structure. The sole exception is a constraint the code can't express.
- Feature-Sliced Design (FSD) v2.1 governs every renderer file. The new `shared/ui` segment carries its own `index.ts` public application programming interface, the settings slice exports through `pages/settings/index.ts`, and no slice reaches into another slice's internals.
- `.dependency-cruiser.cjs` keeps the renderer out of main and preload except the type declaration, and its `no-orphans` rule means every new shared control needs an importer.
- `steiger.config.ts` runs the recommended FSD ruleset, so the new segment and slice satisfy the public application programming interface and slice significance rules.
- Test-first, always: red, green, refactor. No implementation code before a failing test.
- Tests verify state, not interactions. Test doubles appear only at real process boundaries: network, filesystem, clock, and child processes.
- Test code changes if and only if behavior changes. A pure refactor never touches a test.
- Load-bearing derived types get `*.test-d.ts` specs with `expectTypeOf`, run through vitest typecheck.
- Every technical decision becomes an ADR under `docs/adr/`.
- `main` stays protected. One job, one branch, one pull request.
- Authored markdown passes Vale and cspell. Never use an em dash.

## Design

### The shape

Four layers move together, and each one has a clear owner.

1. **Contracts** hold the version 2 settings schema, the twelve-channel registry, the two new payload schemas, and the migration engine's progress guard. Everything downstream types against this layer.
2. **Main** grows a system handler module, token handlers on the existing storage module, an apply step for the whole document, a tray, an application menu, and a window floor.
3. **The renderer's shared layer** gains its first user-interface kit on `@base-ui/react`, plus the moved text field.
4. **The settings page** composes the kit into four sections, reads one query, and writes one mutation.

### The read and write path

One `['settings']` query flows through `settings:get`. The route loader warms it with `ensureQueryData`, and the page reads it with `useSuspenseQuery`. One whole-document mutation flows through `settings:save` and carries `scope: { id: 'settings' }`, so two fast changes serialize instead of clobbering each other. The mutation function reads the current document out of the cache when it executes rather than when the caller builds it. A stale capture therefore can't overwrite a neighbor's change.

Switches and the segmented control commit on change. The port field holds a local draft, commits on blur or Enter, reverts on Escape, and parses through the contract schema before any channel call. Each control moves first and rolls back to the stored value on failure, and the row grows a `role="alert"` line naming what went wrong.

Two more queries sit beside the settings query. `['system']` flows through `system:get` and carries the observed truth. That means the file browser the platform ships, whether the login item is reachable, what the operating system holds for it, whether a tray shows, and the config folder path. `['gateway-token']` flows through `gateway-token:status` and carries the mask plus the secret-storage state. Every successful settings mutation invalidates all three, which is how the login switch and the menu bar switch snap back when the operating system refuses.

### Applying the document

`applySettings` takes an effects port and a settings document, and it fans out three calls: the theme source, the tray visibility, and the login item. The port's implementation lives in `apps/desktop/src/main/index.ts` and holds the Electron calls, so the fan-out itself stays a pure function over an injected boundary.

Boot runs the same path the save path runs. `app.whenReady` awaits `initializeStorage`, applies the returned document, and only then creates the window. Applying the theme before window creation is what keeps a light window from flashing in front of a dark preference. When `initializeStorage` rejects, main logs the failure, applies `defaultSettings()`, and still opens a window.

The storage handler calls the same seam after every successful save, through an `applySettings` entry on `StorageIpcContext`. One function, two callers, no second code path.

### The token

The vault already holds encrypted secrets under a caller-chosen reference. The token takes a fixed reference, `gateway-token`, and never leaves it.

Minting reads the platform's cryptographic random source for 32 bytes, encodes them without padding, and prefixes the result with `rc-local-`. That yields 256 bits of entropy in a 52-character value, past the 128-bit floor the session-management guidance sets. `gateway-token:mint` writes it through `setSecret` and `saveVaultFile`, then answers with the mask alone. The first enable and a regeneration both call this channel, because minting a replacement and minting a first token are the same act.

`gateway-token:copy` reads the secret in main and hands it to an injected clipboard port. The plaintext never crosses the bridge, so no rendered node, screenshot, or screen share can hold it. That also sidesteps the deny-by-default permission handler in `registerPermissionHandlers`, which would otherwise sit between the renderer and `navigator.clipboard`.

Turning the requirement off writes `requireGatewayToken: false` and nothing else. `deleteSecret` never runs against the token reference, so the spec's "the stored token survives" guarantee holds by structure rather than by discipline.

### The settings shortcut

An application menu item carries the `CmdOrCtrl+,` accelerator. A menu accelerator beats `globalShortcut`, which would take the chord away from every other application on the machine.

Its handler resolves one of two paths. With no window open it calls `createMainWindow('/settings')`, and the factory appends the route to the renderer URL. With a window open it shows the window, focuses it, and loads the settings URL into the existing web contents. `router.tsx` moves to unconditional hash history so both modes build the same URL shape, and so a fragment change is all the navigation needs.

The shortcut carries a search param, and the page places focus on its first live control only when it arrives that way. Mounting would steal focus from someone who clicked over from the sidebar, which the accessibility references cite against.

### Rows that wait

Four rows render inert: bind address, gateway autostart, log retention, and reduced wire motion. Each one keeps `aria-disabled="true"` rather than the native attribute, stays in the tab order, suppresses its own interaction, and wires its waiting-on reason through `aria-describedby`. A keyboard reader reaches the row and hears why it can't move. None of the four owns a schema field.

The launch-at-login row splits three ways. On Linux the row never renders, because Electron will never support the login item there. In an unpackaged build the row renders inert and names the development build, because a login item created from `pnpm dev` points at the Electron binary rather than at recompose. Everywhere else it renders live and reads its state from the operating system.

Telemetry keeps the full row anatomy: a label, a static right-aligned value reading None, and a description stating that recompose never phones home. An empty control slot would read as a control that failed to load.

### Sequence: a person turns the token requirement on

```
renderer            settings:save        applySettings      gateway-token:mint     vault
   |                     |                    |                     |               |
   |-- optimistic on --->|                    |                     |               |
   |                     |-- write file ----->|                     |               |
   |                     |-- theme/tray/login ->                    |               |
   |<-- stored document -|                    |                     |               |
   |-- mint (mask null) ------------------------------------------->|               |
   |                     |                    |                     |-- setSecret ->|
   |<-- masked token ----------------------------------------------|               |
   |-- invalidate settings, system, gateway-token                                    |
```

A failed mint leaves the requirement on with no token. The row states that, and offers a Generate action that calls the same channel.

## Data model and contracts

### The settings document, version 2

`packages/contracts/src/settings.ts` moves `SETTINGS_VERSION` to 2 and exports `ENGINE_PORT_RANGE` as `{ min: 1024, max: 65535 }`, which both the schema bound and the field copy read.

| Field                 | Type                                | Default    | Written by                          |
| --------------------- | ----------------------------------- | ---------- | ----------------------------------- |
| `schemaVersion`       | `z.literal(2)`                      | `2`        | the schema                          |
| `theme`               | `z.enum(['system','light','dark'])` | `'system'` | the Appearance segmented control    |
| `enginePort`          | `z.int()` inside the range          | `8397`     | the Server port field               |
| `launchAtLogin`       | `z.boolean()`                       | `false`    | the General launch switch           |
| `showInMenuBar`       | `z.boolean()`                       | `false`    | the General menu bar switch         |
| `requireGatewayToken` | `z.boolean()`                       | `false`    | the Server token-requirement switch |

The object stays a `z.strictObject`, so an unknown key rejects. No field holds a token, and a type-level spec asserts that absence structurally.

### The migration

`settingsMigrations` gains one entry, `{ from: 1, migrate }`. The step spreads the version 1 document, sets `schemaVersion` to 2, and adds the three new fields at their defaults. It preserves `theme` and `enginePort` untouched. Running it against a version 2 document never happens, because `migrateDocument` stops as soon as the version matches.

### The migration engine's progress guard

`migrateDocument` reads the version after each step and looks up the next step by it. A step that returns a document at the same version, or at a lower one, sends the loop around forever with no error. The guard compares the version after the step against the version before it and throws when the step failed to advance, naming both numbers. It lands test-first, before the settings migration exists.

### The channel registry

`ipcChannels` grows from seven entries to twelve. `IpcChannel`, `IpcRequest`, `IpcResponse`, and `RecomposeIpc` all derive from it, so the type surface follows for free.

| Channel                     | Request          | Response                              |
| --------------------------- | ---------------- | ------------------------------------- |
| `settings:get`              | `z.void()`       | `ipcResult(settingsSchema)`           |
| `settings:save`             | `settingsSchema` | `ipcResult(settingsSchema)`           |
| `system:get`                | `z.void()`       | `ipcResult(systemStateSchema)`        |
| `system:open-config-folder` | `z.void()`       | `ipcResult(z.void())`                 |
| `gateway-token:status`      | `z.void()`       | `ipcResult(gatewayTokenStatusSchema)` |
| `gateway-token:mint`        | `z.void()`       | `ipcResult(gatewayTokenStatusSchema)` |
| `gateway-token:copy`        | `z.void()`       | `ipcResult(z.void())`                 |

The five gateway, account, and existing settings channels keep their shapes. No new channel takes a payload, because every one of them acts on the whole document or on the fixed token reference.

`systemStateSchema` is a strict object:

- `fileBrowser`: `z.enum(['finder', 'explorer', 'file-manager'])`, which the reveal label reads.
- `loginItem`: `z.enum(['available', 'unpackaged', 'unsupported'])`, which decides live, inert, or absent.
- `loginItemEnabled`: `z.boolean()`, read from the operating system on every fetch.
- `menuBarVisible`: `z.boolean()`, read from the tray registry.
- `configFolder`: `nonBlankString`, the path the Data section names and opens.

The platform string never crosses the bridge. Main derives both enums from `process.platform` and `app.isPackaged` through two pure functions, so the renderer switches over closed sets instead of matching strings.

`gatewayTokenStatusSchema` is a strict object:

- `masked`: `z.string().min(1).nullable()`, where `null` means the vault holds no token.
- `storage`: `z.enum(['available', 'plaintext-fallback', 'unavailable'])`, which drives the Linux plaintext warning.

The mask keeps the `rc-local-` prefix, eight bullet characters, and the last four characters of the token. Nothing else about the value reaches the renderer.

### Registration lists

`ipcChannelNames` in `apps/desktop/src/main/ipc/dispatch.ts` is a hand-maintained literal, and `registerIpcHandlers` loops it to bind every handler. A channel missing from that list never binds, and the omission surfaces only as a rejected invoke at runtime. `dispatch.test.ts` gains an assertion that the list and `Object.keys(ipcChannels)` hold the same members, which closes the hole for every future channel.

The preload bridge needs no equivalent guard. `const recompose: RecomposeIpc = Object.freeze({...})` fails to compile when an entry goes missing, because `RecomposeIpc` maps every channel.

`packages/contracts/src/ipc.test.ts` holds the count assertion that reads `exactly the seven specified channels exist`. Its `channelNames` array and its title both move to twelve. The neighboring assertion that no channel name matches `/secret|credential|vault/i` stays, and every new name passes it.

## Error handling

`ipcErrorSchema` grows from four codes to six. The set stays closed, so the renderer branches on it under `noFallthroughCasesInSwitch`.

| Code                 | Raised when                                                        | The screen shows                                                     |
| -------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `validation-failed`  | a payload fails its request schema at dispatch                     | nothing, because the port field parses before it calls               |
| `storage-failed`     | a settings or vault write fails                                    | the row reverts and states that the change didn't save               |
| `vault-unavailable`  | `safeStorage.isEncryptionAvailable()` returns false before a write | the token row names the operating system secret store as unavailable |
| `vault-newer-schema` | the vault file carries a schema version this build can't read      | the token row states that the vault comes from a newer build         |
| `folder-open-failed` | `shell.openPath` resolves a non-empty message                      | the Data row states that the folder didn't open, with the message    |
| `token-missing`      | a copy asks for a token the vault doesn't hold                     | the token row offers Generate instead of Copy                        |

Three rules bind every handler.

- **No silent failure.** `shell.openPath` returns a promise that resolves to an error message rather than throwing, so the handler checks the resolved string and maps a non-empty one into `folder-open-failed`. A synchronous reveal call would have no failure signal at all.
- **Errors carry context.** Each message names the attempted operation and the reason, following the existing `storageFailure` shape.
- **Expected failures travel as typed results.** Every path above returns a failure envelope. Nothing throws across the bridge.

Two failures never reach an error code, because the observed truth already reports them. A login item the operating system refuses to set leaves `loginItemEnabled` false on the next `system:get`, and the switch snaps back. A tray that fails to appear leaves `menuBarVisible` false, and its switch snaps back the same way. Both rows then show the mismatch line the spec's "the switch shows the operating system value" scenario asks for.

## File map

### Contracts

- `packages/contracts/src/migration.ts`: the stepwise engine gains the progress guard (modify)
- `packages/contracts/src/migration.test.ts`: guard specs plus the termination property (modify)
- `packages/contracts/src/settings.ts`: version 2, three fields, the port-range constant, and the first migration step (modify)
- `packages/contracts/src/settings.test.ts`: version 2 defaults and the version 1 round trip (modify)
- `packages/contracts/src/settings.test-d.ts`: the settings type carries the three fields and no token (create)
- `packages/contracts/src/ipc.ts`: five channels, two payload schemas, two error codes (modify)
- `packages/contracts/src/ipc.test.ts`: the channel count moves to twelve (modify)
- `packages/contracts/src/ipc.test-d.ts`: request and response types for the five new channels (modify)
- `packages/contracts/src/index.ts`: the new exports reach the desktop app (modify)

### Main process

- `apps/desktop/src/main/settings/apply-settings.ts`: fans a document out to an injected effects port (create)
- `apps/desktop/src/main/settings/apply-settings.test.ts`: the fan-out spec (create)
- `apps/desktop/src/main/settings/gateway-token.ts`: the fixed reference, the mint, and the mask (create)
- `apps/desktop/src/main/settings/gateway-token.test.ts`: entropy, prefix, and mask specs (create)
- `apps/desktop/src/main/system/file-browser.ts`: maps a platform to the file browser it ships (create)
- `apps/desktop/src/main/system/file-browser.test.ts`: the mapping spec (create)
- `apps/desktop/src/main/system/login-item.ts`: maps platform and packaging to the row's availability (create)
- `apps/desktop/src/main/system/login-item.test.ts`: the availability spec (create)
- `apps/desktop/src/main/ipc/system-ipc.ts`: the system handler factory with Electron injected (create)
- `apps/desktop/src/main/ipc/system-ipc.test.ts`: handler specs against fake ports (create)
- `apps/desktop/src/main/ipc/storage-ipc.ts`: three token handlers and the apply seam (modify)
- `apps/desktop/src/main/ipc/storage-ipc.test.ts`: token round trips against a temp directory (modify)
- `apps/desktop/src/main/ipc/storage-ipc-secret-hygiene.test.ts`: the document never carries the token (modify)
- `apps/desktop/src/main/ipc/dispatch.ts`: `ipcChannelNames` gains five entries (modify)
- `apps/desktop/src/main/ipc/dispatch.test.ts`: the registry totality assertion and new handler stubs (modify)
- `apps/desktop/src/main/tray/tray-menu-template.ts`: the tray menu items, including Quit (create)
- `apps/desktop/src/main/tray/tray-menu-template.test.ts`: the template spec (create)
- `apps/desktop/src/main/tray/menu-bar-tray.ts`: the module-scope tray reference and its lifecycle (create)
- `apps/desktop/src/main/menu/app-menu-template.ts`: the menu template and the settings accelerator (create)
- `apps/desktop/src/main/menu/app-menu-template.test.ts`: the template spec (create)
- `apps/desktop/src/main/menu/app-menu.ts`: installs the menu and binds the settings handler (create)
- `apps/desktop/src/main/windows/quit-policy.ts`: decides whether the last window closing quits the app (create)
- `apps/desktop/src/main/windows/quit-policy.test.ts`: the decision spec (create)
- `apps/desktop/src/main/windows/renderer-url.ts`: builds the renderer URL for a route (create)
- `apps/desktop/src/main/windows/renderer-url.test.ts`: the URL spec (create)
- `apps/desktop/src/main/windows/window-options.ts`: a window floor near 720 by 500 (modify)
- `apps/desktop/src/main/windows/window-options.test.ts`: the floor spec (modify)
- `apps/desktop/src/main/windows/main-window.ts`: the factory takes a route (modify)
- `apps/desktop/src/main/index.ts`: boot order, the effects port, the tray, the menu, and the quit rule (modify)
- `apps/desktop/src/preload/index.ts`: five bridge entries (modify)
- `apps/desktop/resources/trayTemplate.png`: the macOS tray icon at 16 by 16 (create)
- `apps/desktop/resources/trayTemplate@2x.png`: its 32 by 32 variant (create)
- `apps/desktop/resources/tray.ico`: the Windows tray icon (create)

### Renderer, shared layer

- `apps/desktop/src/renderer/src/shared/ui/index.ts`: the segment's public application programming interface (create)
- `apps/desktop/src/renderer/src/shared/ui/switch.tsx`: the switch control (create)
- `apps/desktop/src/renderer/src/shared/ui/segmented-control.tsx`: the radio-group segmented control (create)
- `apps/desktop/src/renderer/src/shared/ui/numeric-field.tsx`: the numeric field (create)
- `apps/desktop/src/renderer/src/shared/ui/text-field.tsx`: the moved text field, rebuilt on the same base (create)
- `apps/desktop/src/renderer/src/shared/ui/field-row.tsx`: label, description, right-aligned control slot, inert state (create)
- `apps/desktop/src/renderer/src/shared/ui/field-group.tsx`: the overline heading and the card stack (create)
- `apps/desktop/src/renderer/src/shared/ui/*.stories.tsx`: one story file per control (create)
- `apps/desktop/src/renderer/src/shared/testing/fake-bridge.ts`: a settings seed plus five new stubs (modify)
- `apps/desktop/src/renderer/src/app/styles/theme.css`: one semantic token for the inert state (modify)

### Renderer, providers fallout

- `apps/desktop/src/renderer/src/pages/providers/ui/text-field.tsx`: moved to the shared segment (delete)
- `apps/desktop/src/renderer/src/pages/providers/ui/text-field.stories.tsx`: moved with it (delete)
- `apps/desktop/src/renderer/src/pages/providers/ui/connect-account-form.tsx`: imports the shared text field (modify)
- `apps/desktop/src/renderer/src/pages/providers/ui/account-kind-field.tsx`: keeps its native select and recomposes on the shared field row (modify)
- `apps/desktop/src/renderer/src/pages/providers/ui/account-kind-field.stories.tsx`: follows the recomposition (modify)
- `apps/desktop/src/renderer/src/pages/providers/ui/providers-page.browser.test.tsx`: follows the moved import (modify)

### Renderer, settings page

- `apps/desktop/src/renderer/src/app/routes/settings.tsx`: the file route, its loader, and its component (create)
- `apps/desktop/src/renderer/src/app/routes/__root.tsx`: the sidebar gains a System group holding Settings (modify)
- `apps/desktop/src/renderer/src/app/router.tsx`: hash history in every mode (modify)
- `apps/desktop/src/renderer/src/app/router.browser.test.tsx`: the settings link and loader specs (modify)
- `apps/desktop/src/renderer/src/pages/settings/index.ts`: the slice public application programming interface (create)
- `apps/desktop/src/renderer/src/pages/settings/api/settings.ts`: the query options and the save mutation (create)
- `apps/desktop/src/renderer/src/pages/settings/api/system.ts`: the system query and the folder action (create)
- `apps/desktop/src/renderer/src/pages/settings/api/gateway-token.ts`: the token query, mint, and copy (create)
- `apps/desktop/src/renderer/src/pages/settings/lib/row-state.ts`: pure row-state derivations from the system state (create)
- `apps/desktop/src/renderer/src/pages/settings/lib/row-state.test.ts`: the derivation spec (create)
- `apps/desktop/src/renderer/src/pages/settings/ui/settings-page.tsx`: the column and the four sections (create)
- `apps/desktop/src/renderer/src/pages/settings/ui/general-section.tsx`: launch at login, menu bar, telemetry (create)
- `apps/desktop/src/renderer/src/pages/settings/ui/server-section.tsx`: port, bind address, token requirement, autostart (create)
- `apps/desktop/src/renderer/src/pages/settings/ui/appearance-section.tsx`: theme and reduced wire motion (create)
- `apps/desktop/src/renderer/src/pages/settings/ui/data-section.tsx`: config folder and log retention (create)
- `apps/desktop/src/renderer/src/pages/settings/ui/engine-port-row.tsx`: the local draft and its commit rules (create)
- `apps/desktop/src/renderer/src/pages/settings/ui/gateway-token-row.tsx`: the mask, copy, and the two-phase confirmation (create)
- `apps/desktop/src/renderer/src/pages/settings/ui/*.stories.tsx`: stories for the page and both bespoke rows (create)
- `apps/desktop/src/renderer/src/pages/settings/ui/settings-page.browser.test.tsx`: the page's behavior specs (create)

### Tests, config, and records

- `apps/desktop/e2e/features/settings/`: the nine approved scenario files, copied from `openspec/changes/settings-screen/gherkin/settings/` without renaming (create)
- `apps/desktop/e2e/steps/settings.steps.ts`: their step definitions (create)
- `apps/desktop/e2e/steps/app.steps.ts`: a step that reaches the settings screen (modify)
- `apps/desktop/e2e/fixtures.ts`: teardown that restores the login item it changed (modify)
- `apps/desktop/e2e/visual.spec.ts`: the settings screen baseline (modify)
- `apps/desktop/e2e/visual.spec.ts-snapshots/`: new settings baselines, and regenerated home and providers baselines, on all three platforms (create and modify)
- `apps/desktop/.storybook/recompose-bridge.tsx`: the settings parameter flows through the decorator (modify)
- `apps/desktop/vitest.config.ts`: coverage excludes for the tray and menu shells (modify)
- `apps/desktop/stryker.config.json`: mutate excludes for the same two shells (modify)
- `apps/desktop/package.json`: the `@base-ui/react` dependency (modify)
- `docs/adr/0044-base-ui-shared-component-base.md`: the kit's base and the rejected libraries (create)
- `docs/adr/0045-launch-at-login-absent-on-linux.md`: the Linux stance (create)
- `docs/adr/0046-open-config-folder-over-reveal.md`: `shell.openPath` over `showItemInFolder` (create)
- `docs/adr/0047-gateway-token-vault-and-clipboard.md`: the token's storage, copy route, and reveal stance (create)
- `docs/adr/README.md`: four index rows (modify)

## Interfaces

### Contracts

- Consumes: `zod`, and the existing `Migration`, `migrateDocument`, `nonBlankString`, and `ipcResult` helpers.
- Produces:
  - `export const SETTINGS_VERSION = 2`
  - `export const ENGINE_PORT_RANGE: { readonly min: 1024; readonly max: 65535 }`
  - `export type Settings` with `schemaVersion`, `theme`, `enginePort`, `launchAtLogin`, `showInMenuBar`, and `requireGatewayToken`
  - `export const systemStateSchema` and `export type SystemState`
  - `export const gatewayTokenStatusSchema` and `export type GatewayTokenStatus`
  - `IpcError['code']` as `'vault-unavailable' | 'vault-newer-schema' | 'validation-failed' | 'storage-failed' | 'folder-open-failed' | 'token-missing'`
  - `IpcChannel` widened to twelve members, with `IpcRequest`, `IpcResponse`, and `RecomposeIpc` following

### Main, storage handlers

- Consumes: `StorageIpcContext` widened to `{ userDataPath: string; getCodec: () => SecretCodec; isEncryptionAvailable: () => boolean; onCorrupt: (quarantinedPath: string) => void; applySettings: (settings: Settings) => void; writeClipboard: (text: string) => void }`.
- Produces: `createStorageIpcHandlers(ctx: StorageIpcContext): IpcHandlers` covering ten channels, including `gateway-token:status`, `gateway-token:mint`, and `gateway-token:copy`.

### Main, system handlers

- Consumes: `SystemIpcContext` as `{ fileBrowser: FileBrowser; loginItem: LoginItemAvailability; configFolder: string; readLoginItem: () => boolean; isMenuBarVisible: () => boolean; openFolder: (path: string) => Promise<string> }`.
- Produces: `createSystemIpcHandlers(ctx: SystemIpcContext): Pick<IpcHandlers, 'system:get' | 'system:open-config-folder'>`.

### Main, pure decisions

- Produces:
  - `fileBrowserFor(platform: NodeJS.Platform): FileBrowser`
  - `loginItemAvailabilityFor(platform: NodeJS.Platform, packaged: boolean): LoginItemAvailability`
  - `shouldQuitOnLastWindowClose(platform: NodeJS.Platform, menuBarVisible: boolean): boolean`
  - `rendererUrlFor(base: string, route: string): string`
  - `applySettings(effects: SettingsEffects, settings: Settings): void`, where `SettingsEffects` is `{ setThemeSource: (theme: Settings['theme']) => void; setMenuBarVisible: (visible: boolean) => void; setLoginItem: (enabled: boolean) => void }`
  - `GATEWAY_TOKEN_REF`, `mintGatewayToken(): string`, and `maskGatewayToken(token: string): string`
  - `buildAppMenuTemplate(platform: NodeJS.Platform, onOpenSettings: () => void): MenuItemConstructorOptions[]`
  - `buildTrayMenuTemplate(handlers: TrayMenuHandlers): MenuItemConstructorOptions[]`

### Renderer, shared kit

- Consumes: `@base-ui/react`, and the design tokens in `apps/desktop/src/renderer/src/app/styles/theme.css`.
- Produces, all through `shared/ui/index.ts`:
  - `Switch({ label, checked, onChangeChecked, inert?, describedBy? })`
  - `SegmentedControl<Value extends string>({ label, value, options, onChangeValue, inert? })`
  - `NumericField({ label, value, min, max, onCommitValue, description })`
  - `TextField({ label, value, type?, onChangeValue })`, keeping the existing prop names
  - `FieldRow({ label, description?, control, status?, inert?, reason? })`
  - `FieldGroup({ heading, children })`

### Renderer, settings slice

- Consumes: the twelve-channel bridge on `window.recompose`, `unwrapIpcResult`, and the shared kit.
- Produces, through `pages/settings/index.ts`: `SettingsPage`, `settingsQueryOptions`, `systemQueryOptions`, and `gatewayTokenQueryOptions`.

## Decisions

### 1. Base UI is the base of the shared kit

`@base-ui/react` 1.6.0 underpins the switch, the segmented control, the numeric field, and the field row. Its number field renders a text input with a configurable input mode rather than `type="number"`, which is the accessible shape the United Kingdom government design system moved to after user research. Its `Field` and `Fieldset` primitives wire the label, the description, and the description reference the grouped row needs. It documents which components inject inline styles and ships a nonce provider, so the Content Security Policy (CSP) baseline in ADR-0028 survives.

The segmented control builds on the radio group primitive rather than a toggle group, because one of three mutually exclusive values is a radio group. Primer's design system rejects the radio group role on the grounds that radio groups imply a save button. That objection is a convention claim rather than a normative one, and this screen applies every change at once, so the authoring practices for the radio pattern win.

**Alternatives considered:** Radix, rejected because it ships no number field at all, which makes the hardest primitive of the four a hand-rolled spinbutton. React Aria Components, rejected because its deeper localization and its heavier style contract buy little against a single Chromium target and a bespoke two-tier token system. Ark UI, rejected because its multi-framework state-machine layer is surface this React-only renderer can't use. Hand-rolling all four, rejected because the maintainer expects many more presentational components as screens land, and one base beats four bespoke implementations.

**ADR draft:** `docs/adr/0044-base-ui-shared-component-base.md`

### 2. Launch at login never renders on Linux

Electron's login-item calls cover macOS and Windows. The Linux request sits closed as a decision not to implement. The row therefore never renders on Linux, and no schema change or fallback path pretends otherwise. `launchAtLogin` stays a stored field, because it records intent, and a later Linux implementation would write it.

**Alternatives considered:** the `auto-launch` package, rejected on three counts. Its last stable release predates this repository, a release candidate has sat unreleased for over two years, and it guesses the executable path from `process.execPath`. That last value is wrong for an AppImage. A hand-written autostart file against the freedesktop specification, rejected because the maintainer's locked decision draws a line between absent and inert, and an unwritten platform integration is absent. Rendering the row inert on Linux, rejected for the same reason: inert means not right now, and this is never.

**ADR draft:** `docs/adr/0045-launch-at-login-absent-on-linux.md`

### 3. The config folder opens through `shell.openPath`

`shell.openPath` returns a promise that resolves to an empty string on success and to an error message on failure. `shell.showItemInFolder` returns nothing and reports no failure at all. The spec asks for the file browser to open at the folder, which is what `openPath` does. The no-silent-failures rule needs the signal the other call can't give. The action label follows the platform, so a Windows reader never meets a macOS word.

**Alternatives considered:** `shell.showItemInFolder`, rejected on the missing failure signal and on a long defect tail around paths carrying a dot, a forward slash, or a non-Latin character.

**ADR draft:** `docs/adr/0046-open-config-folder-over-reveal.md`

### 4. The gateway token lives in the vault and copies through main

This decision meets the ADR bar on its own. It deviates from a cited standard, it constrains every later secret-bearing feature, and it trades a documented exposure for a usable interaction.

The token takes a fixed vault reference and never touches the settings document, which sits on disk in plain text. Main mints 32 bytes from the platform's cryptographic random source, which clears the 128-bit floor the session-management guidance sets. The screen shows a prefix-and-tail mask and nothing more. Copy runs in main against an injected clipboard port, so the plaintext never crosses the bridge and never meets the deny-by-default permission handler. The design offers no reveal, which departs from the identity guidance that says a verifier should offer to display a secret during entry. That guidance covers a secret a person types, and nobody types this one.

The bearer-token standard mandates transport security, which a loopback listener can't offer. That deviation is defensible for a local-only listener, and the record states it rather than leaving it unmentioned. Copying to the clipboard exposes the value to Windows clipboard history, which Electron can't suppress. The design accepts and documents that rather than clearing the clipboard on a timer, because a timed wipe surprises a person who copied on purpose.

**Alternatives considered:** storing the token in the settings document, rejected because the document is plain text and the spec forbids it. `navigator.clipboard.writeText` in the renderer, rejected because it needs the plaintext in the renderer and it meets a permission handler that denies everything. A reveal action beside copy, rejected because a revealed token survives in screenshots and screen shares. Deleting the token when the requirement turns off, rejected because the spec requires it to survive.

**ADR draft:** `docs/adr/0047-gateway-token-vault-and-clipboard.md`

### 5. The migration guard lands before the first migration

`migrateDocument` loops forever on a step that fails to advance the version. Nothing exercises that path today, because no migration exists. The settings step is the first, so the guard lands first, test-first, in its own commit ahead of the schema change.

**Alternatives considered:** an iteration ceiling, rejected because a ceiling reports the wrong cause and hides which step misbehaved. Writing the migration first and the guard after, rejected because that ships a hang and then repairs it.

**ADR draft:** None. The guard closes a defect in an engine ADR-0016 already covers.

### 6. One apply seam serves boot and save

`applySettings` runs on the storage context after every successful save and again at boot, consuming the `initializeStorage` result its caller throws away today. Two callers, one function, no drift between what boot applies and what a save applies. Applying before window creation is what stops a wrong-theme flash.

**Alternatives considered:** applying inside each handler, rejected because three handlers would each need the same three effects. A renderer-side theme class, rejected because `nativeTheme.themeSource` also restyles Electron's own menus and developer tools, and every token in the stylesheet already resolves through `light-dark(...)`.

**ADR draft:** None. It's an internal seam inside the storage boundary ADR-0018 already defines.

### 7. The settings shortcut rides an application menu accelerator

An application menu item carries `CmdOrCtrl+,`. With no window open the handler creates one pointed at the settings route. With a window open it focuses the window and loads the settings URL, which unconditional hash history turns into a fragment change.

**Alternatives considered:** `globalShortcut`, rejected because it takes the chord from every other application while recompose runs. A main-to-renderer event channel behind a preload subscription, rejected for now because it adds a second bridge shape and a second global object for one message. It stays the recorded fallback if the fragment path proves wasteful.

**ADR draft:** None.

### 8. The system state crosses the bridge as closed enums

Main derives the file browser, the login-item availability, the login-item value, the tray visibility, and the config folder, and sends them as one strict object. Two pure functions do the deriving, so the platform string never reaches the renderer and the renderer switches over closed sets.

**Alternatives considered:** sending `process.platform` and letting the renderer decide, rejected because it scatters platform knowledge across the renderer and admits values outside the three shipped targets. A channel per fact, rejected because five channels would each pay the round trip that one query already pays.

**ADR draft:** None.

### 9. `TextField` moves and `AccountKindField` stays

`text-field.tsx` carries no business knowledge and matches the kit's shape, so it joins `shared/ui` and rebuilds on the same base as the new controls. Leaving it would seed two input languages on the first day. `AccountKindField` holds account-kind knowledge rather than presentation, so it stays in its page and recomposes on the shared field row. It keeps its native select, which preserves the combobox role the existing visual spec drives. `EmptyState` stays, because it's page copy.

**Alternatives considered:** turning `AccountKindField` into a segmented control, rejected because it would break the acceptance step that selects an option by role and would change providers behavior this change never scoped.

**ADR draft:** None. ADR-0010 already governs Feature-Sliced placement.

## Test matrix

| Layer          | What this layer proves (or why none)                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Check command                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Unit           | The migration guard throws on a step that fails to advance the version. The version 1 document migrates forward preserving theme and port. The mask keeps the prefix and the last four characters and nothing else. Two mints differ. The pure decision functions `fileBrowserFor`, `loginItemAvailabilityFor`, `shouldQuitOnLastWindowClose`, `rendererUrlFor`, `applySettings`, and the row-state derivations each answer their whole input domain. Type-level specs pin the settings and channel types. | `pnpm run test`                                                                                                 |
| Integration    | The token handlers round-trip against a real temp directory: mint writes the vault, status reads the mask, copy reaches the injected clipboard, and the requirement turning off leaves the secret intact. The system handlers map a resolved failure message into `folder-open-failed`. Dispatch registers every channel the registry names.                                                                                                                                                               | `pnpm run test`                                                                                                 |
| End-to-end     | In the real Electron shell: the theme repaints and survives a restart, an out-of-range port keeps the stored value and states the range, the token requirement mints and masks, the tray keeps the app alive after the last window closes, the shortcut opens a window on the settings surface, and the four inert rows stay reachable. Three-platform screenshots pin the layout.                                                                                                                         | `pnpm run test:e2e` and `pnpm --filter @recompose/desktop run test:e2e:visual`                                  |
| Property       | The migration engine terminates for every chain whose steps advance, and throws for every step that doesn't. Every valid version 1 document migrates and parses under version 2. Every masked token hides every window of its body. Every generated settings document serializes without any fragment of the stored token. Every integer outside the port range rejects, and every integer inside it parses.                                                                                               | `pnpm run test`                                                                                                 |
| Mutation scope | Every changed file under `packages/contracts/src/**/*.ts` and `apps/desktop/src/main/**/*.ts`, diff-scoped from the pull request base, with the config exclude list appended and `--incremental` set. The two Electron shells added here, `menu-bar-tray.ts` and `app-menu.ts`, join the exclude list, and their decisions live in the template modules that stay in scope. Break thresholds hold at 77 for contracts and 81 for desktop main.                                                             | `pnpm --filter @recompose/contracts run test:mutation` and `pnpm --filter @recompose/desktop run test:mutation` |

### Designated mutant killers

Each invariant below names the property test that carries it. A property test alone doesn't reliably kill the mutants in that logic, so each row also carries example tests over the boundary its generator misses.

Measured on `packages/contracts/src/migration.ts` with the repository's own configuration: property tests do run against mutants, and Stryker attributes their coverage correctly. The run reported zero uncovered mutants and named a property among the tests it ran. What they can't do is reach a branch their generator never produces. A round-trip property over valid documents left `version < 1` mutated to `false` alive, because it never generates an invalid version. The seed also changes per run, so a property that catches a mutant once may miss it next time.

The rule that follows: a property test pins an invariant across a range, and an example test pins the boundary. The mutation gate leans on the second.

| Invariant                                          | Mutant killer                                                                                              |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| A migration step must advance the version          | the termination property in `packages/contracts/src/migration.test.ts`, which pins the comparison boundary |
| A version 1 document keeps its theme and its port  | the round-trip property in `packages/contracts/src/settings.test.ts`                                       |
| The port range is exactly 1024 through 65535       | the boundary property over `ENGINE_PORT_RANGE` in `packages/contracts/src/settings.test.ts`                |
| The mask reveals only the prefix and the last four | the masking property in `apps/desktop/src/main/settings/gateway-token.test.ts`                             |
| The settings document never carries the token      | the serialization property in `apps/desktop/src/main/ipc/storage-ipc-secret-hygiene.test.ts`               |
| The last window closing quits only without a tray  | the table-driven spec in `apps/desktop/src/main/windows/quit-policy.test.ts`                               |

### Type-level specs

`packages/contracts/src/ipc.test-d.ts` grows assertions that the five new channels take no payload, that `IpcError['code']` holds exactly six members, and that `keyof RecomposeIpc` still equals `IpcChannel`. A new `packages/contracts/src/settings.test-d.ts` asserts that `Settings['schemaVersion']` is `2`, that the three new fields are `boolean`, and that `Settings` has no property naming a token. That last assertion turns the spec's "the settings document never carries the token" scenario into a compile-time fact.

### The accessibility question the stories answer

The shared kit's stories run under the Storybook accessibility addon in the `storybook` vitest project. The numeric field's story is where the open question about Base UI's exposed role closes, before the primitive lands in the settings page.

## Task decomposition hooks

Seven clusters run in parallel worktrees over disjoint file sets. Only three things justify making one wait: a cluster reads what another produces, two clusters own one file, or one cluster inspects what another writes. Each blocker below names which of the three applies.

- **Cluster A: contracts.** Owns every path under `packages/contracts/src/`. Depends on none. Hands off `SETTINGS_VERSION = 2`, the version 2 `Settings` type, `ENGINE_PORT_RANGE`, the twelve-channel registry, `systemStateSchema`, `gatewayTokenStatusSchema`, and the six-code error set. Its first task is the migration guard, test-first, before the version bump. It lands first because every other cluster types against it.
- **Cluster B: main storage, token, and the channel list.** Owns `apps/desktop/src/main/ipc/storage-ipc.ts`, `storage-ipc.test.ts`, `storage-ipc-secret-hygiene.test.ts`, `dispatch.ts`, `dispatch.test.ts`, `apps/desktop/src/main/settings/gateway-token.ts` and its spec, and `apps/desktop/src/preload/index.ts`. Depends on A, because it reads A's channel registry. Hands off the widened `StorageIpcContext` and the ten-channel handler factory.
- **Cluster C: main system, tray, menu, and window.** Owns `apps/desktop/src/main/ipc/system-ipc.ts` and its spec, everything under `apps/desktop/src/main/system/`, `apps/desktop/src/main/tray/`, `apps/desktop/src/main/menu/`, `apps/desktop/src/main/settings/apply-settings.ts` and its spec, `apps/desktop/src/main/windows/quit-policy.ts`, `renderer-url.ts`, `window-options.ts`, `main-window.ts`, their specs, and the tray assets under `apps/desktop/resources/`. Depends on A, because it reads A's system schema. Runs beside B on disjoint files. Hands off `createSystemIpcHandlers`, `applySettings`, `SettingsEffects`, and the tray and menu installers.
- **Cluster D: the shared kit and the providers fallout.** Owns everything under `apps/desktop/src/renderer/src/shared/ui/`, the providers files that follow the moved text field, `apps/desktop/src/renderer/src/app/styles/theme.css`, and `apps/desktop/package.json`. Depends on A only for `ENGINE_PORT_RANGE`. Runs beside B and C on disjoint files. Hands off the six exported controls and the inert-state token.
- **Cluster E: the settings page and the route.** Owns everything under `apps/desktop/src/renderer/src/pages/settings/`, `app/routes/settings.tsx`, `app/routes/__root.tsx`, `app/router.tsx`, `app/router.browser.test.tsx`, `apps/desktop/src/renderer/src/shared/testing/fake-bridge.ts`, and `apps/desktop/.storybook/recompose-bridge.tsx`. Depends on A and D, because it reads D's controls. Hands off the slice public application programming interface.
- **Cluster F: bootstrap and gate config.** Owns `apps/desktop/src/main/index.ts`, `apps/desktop/vitest.config.ts`, and `apps/desktop/stryker.config.json`. Depends on B and C, because it wires the factories both clusters produce. Hands off a running application with every channel registered.
- **Cluster G: acceptance, visual, and records.** Owns everything under `apps/desktop/e2e/` and the four new files under `docs/adr/` plus the index. Depends on E and F, because it inspects the running application they produce. The visual baselines regenerate on all three platforms, and the home and providers baselines move too, because the sidebar gains a group and the text field changes its markup.

## Risks

- [Risk] `settingsMigrations` grows a step that fails to advance the version, and the application hangs at boot → Mitigation: the progress guard lands first, test-first, with a property test pinning its comparison boundary.
- [Risk] A new channel reaches `ipcChannels` but not `ipcChannelNames`, so it never binds and fails only at runtime → Mitigation: `dispatch.test.ts` asserts the two lists hold the same members.
- [Risk] The tray reference falls out of scope and the icon vanishes minutes later with no error → Mitigation: the reference lives at module scope in one module that owns the whole lifecycle, and `before-quit` destroys it.
- [Risk] With the tray showing and `window-all-closed` suppressed, a Windows or Linux user has no way to quit → Mitigation: the tray menu always carries a Quit item, and the template spec asserts it.
- [Risk] An acceptance run writes a real login item on a developer machine → Mitigation: the fixture reads the prior value, restores it in teardown, and the scenario runs on macOS and Windows only.
- [Risk] The tray icon fails to load, because the `?asset` import hashes filenames and breaks the `@2x` naming convention macOS relies on → Mitigation: the tray module builds one image from the base file and adds the 2x representation explicitly, then marks it a template image.
- [Risk] A reported theme regression on one Linux desktop inverts the resolved scheme, and nobody has confirmed whether this Electron version carries it → Mitigation: the three-platform visual baselines catch an inverted render, and an acceptance assertion compares the reported dark-mode flag against the rendered scheme.
- [Risk] Loading the settings URL into an open window reloads the document instead of changing the fragment, which discards an uncommitted port draft → Mitigation: every observable outcome the spec names still holds after a reload, and the recorded fallback is a main-to-renderer event channel.
- [Risk] Base UI's numeric field exposes a role the authoring practices don't sanction → Mitigation: the accessibility addon checks it in the story before the settings page consumes it, and the fallback is a plain text input with a numeric input mode and the range wired through the description.
- [Risk] The moved text field changes providers markup and breaks the acceptance steps that drive it by role → Mitigation: the shared control keeps the same label association, role, and prop names, so nothing but the rendering moves.
- [Risk] Downgrading to a build that predates version 2 quarantines the settings document and resets to defaults → Mitigation: the quarantined copy stays on disk beside the settings file, and a typed downgrade error goes to the rider ledger rather than into this change.

## Migration and rollout

**Deploy.** One release carries the whole change. Nothing behind a flag, because a half-present settings screen is worse than none.

**Data migration.** A version 1 document migrates on the first read after the upgrade. `loadSettingsFile` reads through `loadSettings`, which runs `migrateDocument` and then parses. The step preserves `theme` and `enginePort` and adds `launchAtLogin`, `showInMenuBar`, and `requireGatewayToken` at false. The migration runs in memory, so the version 2 document reaches disk at the first save rather than at boot. Running the chain against a version 2 document is a no-op, because the loop stops as soon as the version matches.

A person with no settings file gets `defaultSettings()` at version 2 and never meets the migration. A corrupt file follows the existing quarantine path, which renames it beside the original and returns defaults.

**Rollback.** Reverting the application leaves a version 2 document on disk. The older build's `migrateDocument` throws on a version it doesn't support, `readDocumentWithQuarantine` catches the throw, and the file moves to a quarantine copy while the build starts from defaults. The quarantine keeps every value, though a person who rolls back stops seeing them until they roll forward again. The typed downgrade error that would replace this behavior belongs to a separate change, filed on the rider ledger.

**The vault.** The token adds one entry under a new reference. Older builds read the vault file, find an entry they don't recognize, and leave it alone. The vault holds a flat reference map with no schema over its keys.

## Open questions

- **Base UI's numeric field exposes an undocumented role.** Its documentation advertises a role description and never states the underlying role. The story for `NumericField`, run under the Storybook accessibility addon in the `storybook` vitest project, settles it in cluster D. Either the control exposes the spinbutton role with its value, minimum, and maximum, in which case it ships as it stands, or it doesn't, in which case the field falls back to a plain text input with a numeric input mode and the range wired through its description. Both outcomes fit inside the same file and the same task, so neither changes the specs, the approach, or the decomposition.

## End-to-end verification

Run the desktop application from `apps/desktop`, then walk the screen.

1. The sidebar shows a System group holding Settings, and the link opens one scrollable column of four groups: General, Server, Appearance, and Data.
2. Switching the theme to dark repaints the window and Electron's own menus at once. Quitting and relaunching keeps it dark with no light flash.
3. Typing 80 into the port field and leaving it keeps 8397 and states the accepted range. Typing 9000 and pressing Enter stores 9000. Pressing Escape mid-edit restores the stored value.
4. Turning Require API token on shows a masked value starting `rc-local-` and ending in four characters of the token. Copy places 52 characters on the clipboard. Regenerate asks for confirmation with Cancel focused, and Escape cancels.
5. Turning the requirement off hides the token row. Turning it on again shows the same mask.
6. Opening the config folder opens the operating system file browser at the folder the row names, under a label naming that platform's browser.
7. Turning Show in menu bar on puts a tray icon in place with no restart. Closing the last window leaves the application running, and the tray menu quits it.
8. Pressing the settings shortcut with no window open opens a window on the settings surface with the sidebar selection moved and focus on the first control.
9. Bind address, gateway autostart, log retention, and reduced wire motion each render inert, take keyboard focus, and name what they wait for. Launch at login is absent on Linux and inert in an unpackaged build.

A fresh-context reviewer diffs the result against these criteria:

- `SETTINGS_VERSION` is 2, `settingsMigrations` holds exactly one step, and the progress guard landed in a commit before the version bump.
- `ipcChannels` holds twelve entries, `ipcChannelNames` holds the same twelve, the preload bridge holds the same twelve, and a test asserts each equality.
- `ipcErrorSchema` holds six codes and the renderer branches on all six.
- No settings payload, response schema, or serialized document carries a token, and a type-level spec proves the absence.
- `apps/desktop/src/renderer/src/shared/ui/index.ts` exports six controls, every one of them has a story, and the settings page imports every one, so `no-orphans` holds.
- `pages/providers/ui/text-field.tsx` no longer exists, `connect-account-form.tsx` imports from `shared/ui`, and `AccountKindField` still renders a native select.
- The four waiting rows carry `aria-disabled="true"`, sit in the tab order, and reference a visible reason.
- `applySettings` has exactly two callers, the boot path and the save handler.
- Four Architecture Decision Records land as 0044 through 0047, and the index carries their rows. The numbers shifted by one, because 0043 landed while this change was in flight.
- Visual baselines exist for the settings screen on all three platforms, and the home and providers baselines regenerated.
