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
- [x] **Step 2: The login item takes a write.** Reading landed; setting it didn't. One shared call site keeps the path and arguments identical between the read and the write, which is the documented cause of a switch that lies.
- [x] **Step 3: The tray controller owns the whole lifecycle.** The reference lives at module scope, because a collected reference makes the icon vanish minutes later with no error. The menu always carries a quit item, which is the only way out on Windows and Linux once the last window may close.
- [x] **Step 4: The quit policy becomes a pure decision.** The app quits on a non-macOS platform only when the tray isn't showing.
- [x] **Step 5: The window gains a floor.** `window-options.ts` carries no minimum size today, so the column tears below 850 pixels.
- [x] **Step 6: The settings shortcut rides an application menu accelerator,** and it opens a window when none stands open.
- [x] **Step 7: The config folder opens through `shell.openPath`,** and a non-empty result maps to a typed failure rather than a silent one. It landed with the compile unit, because it sits on the channel map.
- [x] **Step 8: One apply seam serves boot and save.** It sets the theme source and the tray from the document, and it consumes the storage result its caller discards today.

## The shared-kit cluster

**Files:** everything under `apps/desktop/src/renderer/src/shared/ui/`, the providers files that follow the moved text field, `app/styles/theme.css`, and `apps/desktop/package.json`.

**Blockers:** reads the port range that contracts produces.

- [x] **Step 1: Adopt `@base-ui/react` and add the inert-state token.** The token line lands beside its neighbors, because the palette carries nothing for a control that can't move.
- [x] **Step 2: The switch, the segmented control, and the numeric field.** The segmented control builds on a radio group, never a toggle group, so arrow keys move and select under one tab stop. The numeric field keeps a text input with a numeric input mode, and it owns the draft against committed distinction.
- [x] **Step 3: The setting row and the setting group.** The row carries a label, a description, an error, and an inert state that stays in the tab order and names what it waits for.
- [x] **Step 4: `TextField` moves into the shared kit** and rebuilds on the same base. `AccountKindField` stays in its page. It recomposed on the row primitive first, which threw its control to the far edge of a form, so it now stacks like the fields beside it.
- [x] **Step 5: A story per control, in both schemes,** with the accessibility addon as a merge gate rather than an advisory. The numeric field's story settles the open question about its exposed role.

## The settings-page cluster

**Files:** everything under `apps/desktop/src/renderer/src/pages/settings/`, `app/routes/settings.tsx`, `app/routes/__root.tsx`, `app/router.tsx`, and `app/router.browser.test.tsx`.

**Blockers:** reads the controls cluster D produces.

- [x] **Step 1: The query and the mutation.** One document query, warmed by the route loader. One whole-document mutation, scoped so concurrent writes serialize, computing its patch from the cache at execution time.
- [x] **Step 2: The four sections.** Live rows sort before waiting rows where the logic allows.
- [x] **Step 3: The token row.** It appears only while the requirement is on, confirms regeneration inline, and warns before minting when the credential store can't encrypt.
- [x] **Step 4: The sidebar gains a System group** holding Settings.
- [x] **Step 5: Page specs against the fake bridge,** asserting persistence as observable state, the rollback on a failed write, and that the full token never reaches the document.
- [x] **Step 6: Stories for the page and both bespoke rows,** with the settings parameter flowing through the bridge decorator. The accessibility addon runs at error level in the browser project, so a story that fails axe fails the suite. The token row earns its own story, because its states carry the most risk: the requirement off, a masked token, the confirmation open, and the plain text warning.

## The bootstrap cluster

**Files:** `apps/desktop/src/main/index.ts`, `apps/desktop/vitest.config.ts`, and `apps/desktop/stryker.config.json`.

**Blockers:** wires the factories clusters A and B, and C, produce.

- [x] **Step 1: Assemble the full handler map** from both factories, and register every channel. It landed with the compile unit, because the map is total and the seam is where totality gets checked.
- [x] **Step 2: Apply the document at boot,** before the window exists, so no wrong-theme flash occurs.
- [x] **Step 3: The quit rule and the teardown.** The tray dies on the way out, so no ghost icon survives.
- [x] **Step 4: Coverage excludes for the thin Electron shells,** and the mutation scope for the new node-side logic.

## The acceptance foundation

**Files:** `apps/desktop/e2e/fixtures.ts`, `apps/desktop/e2e/steps/app.steps.ts`, `apps/desktop/e2e/visual.spec.ts`, and its snapshot directory.

**Blockers:** inspects the running app the page and bootstrap clusters produce.

This lands alone and first inside the end-to-end tree, because every unit in the fan-out below uses its navigation step and its fixture. It carries no feature file, so nothing goes red.

- [x] **Step 1: A navigation step reaches the settings screen,** as the sibling of the two that already exist.
- [x] **Step 2: The fixture restores what it changed,** so an acceptance run never leaves a login item behind on a runner or a developer machine.
- [x] **Step 3: Visual baselines on all three platforms.** The home and providers baselines move too, because the sidebar gains a group and the text field changes its markup.

## The step-definition fan-out

Nine units run in parallel once the foundation lands. Each owns exactly one feature file and one step file, so no two touch the same path.

**Every unit graduates its own feature file together with its step definitions, in one commit.** A feature file that lands without its steps makes `bddgen` fail on the whole tree. Splitting the copy from the automation would therefore turn the branch red for as long as the fan-out runs. Copy from `openspec/changes/settings-screen/gherkin/settings/` without renaming.

| Feature file                         | Step file                                   |
| ------------------------------------ | ------------------------------------------- |
| `settings/screen.feature`            | `steps/settings-screen.steps.ts`            |
| `settings/theme.feature`             | `steps/settings-theme.steps.ts`             |
| `settings/gateway-port.feature`      | `steps/settings-gateway-port.steps.ts`      |
| `settings/gateway-token.feature`     | `steps/settings-gateway-token.steps.ts`     |
| `settings/launch-at-login.feature`   | `steps/settings-launch-at-login.steps.ts`   |
| `settings/menu-bar-presence.feature` | `steps/settings-menu-bar-presence.steps.ts` |
| `settings/config-folder.feature`     | `steps/settings-config-folder.steps.ts`     |
| `settings/waiting-controls.feature`  | `steps/settings-waiting-controls.steps.ts`  |
| `settings/shortcut.feature`          | `steps/settings-shortcut.steps.ts`          |

- [x] **Every unit drives by role rather than by selector,** and asserts what a person can observe. A scenario the app can't answer as written goes back through a spec amendment, never a quiet rewrite, because the set froze at gate 2.
- [x] **A unit that finds its scenario belongs in a main-process spec says so** rather than forcing it through the app. The scenario writer already moved several for that reason.

### Amendment: the tray Quit scenario leaves the automated set

`menu-bar-presence.feature` froze with a fourth scenario, `The tray always offers a way to quit`, that no other frozen artifact asks for. `specs/settings/spec.md` carries exactly two tray scenarios, and the automated set already answers both. The design assigns the Quit claim twice, and to neither the end-to-end layer. The risk table hands it to the template spec. End-to-end verification step 7 walks it by hand. The test matrix names what end-to-end proves about the tray, and Quit isn't in it.

Electron offers no read path either. `Tray` exposes `setContextMenu`, `popUpContextMenu`, and `closeContextMenu`, and no getter, so the menu stays write-only. A live instance holds no own properties. `electron.Tray` is a non-configurable getter, so a test can't wrap it. That left two ways to automate the scenario. A spy on `setContextMenu` asserts an interaction inside the app rather than a state at a process boundary. A stub without assertions asserts nothing at all. The unit proved as much, because the stub stayed green under every mutation that reddened its siblings.

The scenario therefore leaves the gherkin set, which brings the set level with the spec. Its claim keeps the two homes the design gave it. Four tests in `apps/desktop/src/main/tray/tray-menu-template.test.ts` pin the Quit item, its handler, and its place after the separator. Manual verification step 7 walks the rest.

### Where the acceptance tree stops proving things, and what does instead

An adversarial pass mutated the built bundle and found three acceptance claims that survived every mutation they name. Two turned out to be honest limits rather than defects, and recording which is which stops the next reader from trusting the wrong line.

**The tray now reports what it holds.** `menuBarVisible` read `menuBarTray !== null`, a variable kept beside the tray rather than the tray itself. A `hideMenuBarTray` that dropped the reference without destroying passed all 52 scenarios and left an icon on screen forever. The controller keeps its reference and answers from `isDestroyed()`, so the same mutation now fails the scenario that claims the icon goes away. That was a defect, and it's fixed.

**The port range keeps two guards, so one scenario can't fail alone.** Removing the field's range check leaves the four out-of-range scenarios green, because `dispatchIpc` refuses the payload against `settingsSchema` and nothing reaches disk. The spec asks only that the app keeps the stored port and that the field states its range, and both hold under either guard. The field snapping back to the stored value is a separate claim the spec never makes, and `engine-port-row.browser.test.tsx` plus the `Out Of Range Reverts` story carry it. Defense in depth reads as vacuity from inside a single layer.

**An inert row can't prove immovability through the app.** Every waiting row renders a controlled value with a literal and a no-op handler, so its position holds whatever the guard does. The end-to-end steps now assert what they can observe: the row announces `aria-disabled`, absorbs the key press without losing focus, and owns no field in the stored document. `switch.browser.test.tsx` pins the guard itself, as do the `Inert` stories for the segmented control and the text field. Every one of them goes red when the guard leaves.

`launch-at-login.feature` froze with a third scenario, `The switch reports the operating system, not the stored flag`. Its Given asks the operating system to list recompose, and `setLoginItemSettings` writes one machine-global entry that every parallel worker shares. On macOS the `path` and `args` options belong to Windows, so each worker addresses the same binary. The unit measured the damage. The scenario failed two runs in three under the default three workers. A worker launching inside the on window captures the listing, then writes it back after the scenario clears it. The teardown that exists to leave no login item behind is what strands one.

The renderer already answers the scenario, and under the same sentence. `general-section.browser.test.tsx` reports `loginItemEnabled` as true against a stored flag of false, then asserts the switch reads on. That layer holds a real seam, so it discriminates the two sources without touching the machine. The scenario therefore leaves the gherkin set rather than earning a test-only override inside the main process.

The unit also corrected the brief. `getLoginItemSettings` doesn't throw on Linux in the pinned Electron 43.2.0, because `browser_linux.cc` supplies a stub that reports the item as off and `setLoginItemSettings` does nothing at all. The `@platform darwin,win32` tag is documentation, not a runtime guard, so the unconditional read in `observeSystem` is safe on that runner.

## The records task

**Files:** the four new files under `docs/adr/` and the index.

- [x] **Four Architecture Decision Records:** the shared kit's base, the launch-at-login stance, the config folder call, and the token design.
