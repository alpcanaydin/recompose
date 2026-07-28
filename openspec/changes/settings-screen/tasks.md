# Settings-screen tasks

> For agentic workers: use `superpowers:subagent-driven-development` to execute cluster by cluster. Every commit passes lefthook without a bypass. Global constraints: never commit to `main`, no code comments, and `pnpm exec openspec validate --all --strict --no-interactive` stays green after every task. Read [design.md](design.md) before starting a cluster; it holds the decisions these steps carry out. Clusters own disjoint files, and a cluster waits only when it reads what another produces, shares a file, or inspects what another writes.

## Plan delta, recorded at the first replan

The approved decomposition ran contracts as cluster A, alone, and first. That shape doesn't survive contact with the mapped types. Adding five channels to `ipcChannels` makes `RecomposeIpc` and `IpcHandlers` demand entries only the process boundary supplies, so the tree stays red until that boundary lands. The design names that compile error as the totality guard that replaces a hand-written check, which means the guard forbids a green contracts-only commit.

Clusters A and B therefore merge into one compile unit. `apps/desktop/src/renderer/src/shared/testing/fake-bridge.ts` moves from cluster E into it, because a double for the preload bridge changes whenever the bridge changes. The maintainer approved both at the replan.

The unit then grew once more, for the same reason one step further out. The storage factory narrowed to the ten channels it serves, which is right, and the assembly seam went red the moment it did. So the unit also carries the two system handlers and the seam that assembles both factories. The cause isn't the plan. `IpcHandlers` is a total map over the channel set, so adding a channel is atomic across the contract, every factory, and the place they meet. The tray, the menu, the window floor, and the apply seam stay with their cluster, because none of them sits on that map.

What this leaves for later clusters: the system cluster keeps everything except the two handlers and the two pure decisions feeding them. The bootstrap cluster keeps everything except the handler assembly.

## The contracts and process-boundary cluster

**Files:** everything under `packages/contracts/src/`, plus `apps/desktop/src/main/ipc/storage-ipc.ts` and its two specs, `apps/desktop/src/main/ipc/dispatch.ts` and `dispatch.test.ts`, `apps/desktop/src/main/settings/gateway-token.ts` and its spec, `apps/desktop/src/preload/index.ts`, and `apps/desktop/src/renderer/src/shared/testing/fake-bridge.ts`.

**Blockers:** none. It lands first, because every other cluster types against it.

- [x] **Step 1: The migration engine refuses a step that stalls.** `migrateDocument` re-reads the version after each step and loops while the version trails the target, so a step that fails to advance the document spins forever. The red run proved it hangs rather than fails: the worker held 98.6% of a core for 38 seconds with no result, past any test timeout, because a synchronous loop takes no interrupt. A property test pins the comparison boundary.
- [x] **Step 2: The settings document moves to version 2.** Add `launchAtLogin`, `showInMenuBar`, and `requireGatewayToken`, all defaulting to false. Export `ENGINE_PORT_RANGE` and build the port schema from it, so the field's range copy and the validation share one source.
- [x] **Step 3: The version 1 document migrates forward.** The first entry in `settingsMigrations` preserves `theme` and `enginePort`. A property test asserts any valid version 1 document parses under version 2 with both values intact.
- [x] **Step 4: The channel registry grows to twelve.** Add the two system channels and the three token channels, with `systemStateSchema` and `gatewayTokenStatusSchema`. The count assertion moves from seven to twelve, and the assertion that no channel name reads as a secret stays.
- [x] **Step 5: The error set grows to six codes and stays closed.**
- [x] **Step 6: Type-level specs.** `ipc.test-d.ts` gains a request and response assertion per new channel, and `settings.test-d.ts` pins the version 2 shape.
- [x] **Step 7: The storage factory returns its own slice.** It's typed as the full twelve-channel map today, so it can't compile without the two system handlers cluster C owns. Ten channels are its own, and the full map gets assembled where both factories meet.
- [x] **Step 8: The three token channels.** Minting and masking are pure functions. One fixed vault reference holds it, `deleteSecret` never runs for it, and the clipboard write goes through an injected port so the specs need no Electron.
- [x] **Step 9: The registration list can't drift.** `ipcChannelNames` gains the five new names, and an assertion holds it to the same members as the registry, so a future channel can't skip registration in silence.
- [x] **Step 10: The preload bridge gains all twelve entries.** Bridge entries wrap an invoke and need no handler, so the two system entries don't wait on cluster C.
- [x] **Step 11: The fake bridge grows a settings seed and a stub per channel,** with an in-memory token state machine, so page specs assert persistence as observable state.
- [x] **Step 12: The secret-hygiene spec gains its property.** The written settings document carries no token fragment under any sequence of toggles and regenerations.

## The system, tray, menu, and window cluster

**Files:** `apps/desktop/src/main/ipc/system-ipc.ts` and its spec, everything under `apps/desktop/src/main/system/`, `main/tray/`, and `main/menu/`, `main/settings/apply-settings.ts` and its spec, `main/windows/quit-policy.ts`, `window-options.ts`, `main-window.ts` and their specs, and the tray assets under `apps/desktop/resources/`.

**Blockers:** reads what contracts produces. The two system handlers and the two pure decisions feeding them already landed with the compile unit, so this cluster starts from them rather than creating them.

- [x] **Step 1: The pure platform decisions.** `login-item.ts` maps the platform and the packaged flag to available, unpackaged, or unsupported. `file-browser.ts` maps the platform to the browser the reveal label names. Both landed with the compile unit, because `system:get` can't answer without them.
- [ ] **Step 2: The login item takes a write.** Reading landed; setting it didn't. One shared call site keeps the path and arguments identical between the read and the write, which is the documented cause of a switch that lies.
- [ ] **Step 3: The tray controller owns the whole lifecycle.** The reference lives at module scope, because a collected reference makes the icon vanish minutes later with no error. The menu always carries a quit item, which is the only way out on Windows and Linux once the last window may close.
- [ ] **Step 4: The quit policy becomes a pure decision.** The app quits on a non-macOS platform only when the tray isn't showing.
- [ ] **Step 5: The window gains a floor.** `window-options.ts` carries no minimum size today, so the column tears below 850 pixels.
- [ ] **Step 6: The settings shortcut rides an application menu accelerator,** and it opens a window when none stands open.
- [x] **Step 7: The config folder opens through `shell.openPath`,** and a non-empty result maps to a typed failure rather than a silent one. It landed with the compile unit, because it sits on the channel map.
- [ ] **Step 8: One apply seam serves boot and save.** It sets the theme source and the tray from the document, and it consumes the storage result its caller discards today.

## The shared-kit cluster

**Files:** everything under `apps/desktop/src/renderer/src/shared/ui/`, the providers files that follow the moved text field, `app/styles/theme.css`, and `apps/desktop/package.json`.

**Blockers:** reads the port range that contracts produces.

- [ ] **Step 1: Adopt `@base-ui/react` and add the inert-state token.** The token line lands beside its neighbors, because the palette carries nothing for a control that can't move.
- [ ] **Step 2: The switch, the segmented control, and the numeric field.** The segmented control builds on a radio group, never a toggle group, so arrow keys move and select under one tab stop. The numeric field keeps a text input with a numeric input mode, and it owns the draft against committed distinction.
- [ ] **Step 3: The setting row and the setting group.** The row carries a label, a description, an error, and an inert state that stays in the tab order and names what it waits for.
- [ ] **Step 4: `TextField` moves into the shared kit** and rebuilds on the same base. `AccountKindField` stays in its page and recomposes on the shared primitives, because it holds account-kind knowledge rather than presentation.
- [ ] **Step 5: A story per control, in both schemes,** with the accessibility addon as a merge gate rather than an advisory. The numeric field's story settles the open question about its exposed role.

## The settings-page cluster

**Files:** everything under `apps/desktop/src/renderer/src/pages/settings/`, `app/routes/settings.tsx`, `app/routes/__root.tsx`, `app/router.tsx`, and `app/router.browser.test.tsx`.

**Blockers:** reads the controls cluster D produces.

- [ ] **Step 1: The query and the mutation.** One document query, warmed by the route loader. One whole-document mutation, scoped so concurrent writes serialize, computing its patch from the cache at execution time.
- [ ] **Step 2: The four sections.** Live rows sort before waiting rows where the logic allows.
- [ ] **Step 3: The token row.** It appears only while the requirement is on, confirms regeneration inline, and warns before minting when the credential store can't encrypt.
- [ ] **Step 4: The sidebar gains a System group** holding Settings.
- [ ] **Step 5: Page specs against the fake bridge,** asserting persistence as observable state, the rollback on a failed write, and that the full token never reaches the document.

## The bootstrap cluster

**Files:** `apps/desktop/src/main/index.ts`, `apps/desktop/vitest.config.ts`, and `apps/desktop/stryker.config.json`.

**Blockers:** wires the factories clusters A and B, and C, produce.

- [x] **Step 1: Assemble the full handler map** from both factories, and register every channel. It landed with the compile unit, because the map is total and the seam is where totality gets checked.
- [ ] **Step 2: Apply the document at boot,** before the window exists, so no wrong-theme flash occurs.
- [ ] **Step 3: The quit rule and the teardown.** The tray dies on the way out, so no ghost icon survives.
- [ ] **Step 4: Coverage excludes for the thin Electron shells,** and the mutation scope for the new node-side logic.

## The acceptance and records cluster

**Files:** everything under `apps/desktop/e2e/`, the four new files under `docs/adr/`, and the index.

**Blockers:** inspects the running app clusters E and F produce.

- [ ] **Step 1: The scenarios graduate.** Copy `gherkin/settings/` into `e2e/features/settings/` without renaming, together with the step definitions that answer them, so no commit lands red.
- [ ] **Step 2: The step definitions,** one task per scenario, driving by role rather than by selector.
- [ ] **Step 3: The fixture restores what it changed,** so an acceptance run never leaves a login item behind.
- [ ] **Step 4: Visual baselines on all three platforms.** The home and providers baselines move too, because the sidebar gains a group and the text field changes its markup.
- [ ] **Step 5: Four Architecture Decision Records:** the shared kit's base, the launch-at-login stance, the config folder call, and the token design.
