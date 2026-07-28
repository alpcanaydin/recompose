# Settings-screen design

## Why

recompose stores settings already. A schema holds the theme and the engine port, a store writes them to disk, and two channels carry them across the process boundary. None of it reaches the screen. Anyone who wants a different theme edits a JSON file by hand.

The settings screen closes that gap. It also forces the renderer's first shared component layer, because the design calls for switches, segmented controls, and numeric fields that no page owns yet.

## What changes

- A settings route and page slice land in the renderer as one scrollable grouped column across four sections: General, Server, Appearance, and Data.
- The sidebar gains a System group holding Settings.
- The shared layer gains its first components on `@base-ui/react`: a switch, a segmented control, a numeric field, and the grouped row that holds them.
- The settings schema moves to version 2 and gains the fields the screen writes, including `launchAtLogin`. A migration carries a version 1 document forward, behind a new guard against steps that fail to advance the version.
- The main process picks up the login item, a menu bar tray, theme application through `nativeTheme.themeSource`, and a channel that opens the config folder through `shell.openPath`.
- New channels mint the gateway token into the existing vault and copy it through the main-process clipboard, so the token never travels beside the plain settings document.
- Token handlers join `apps/desktop/src/main/ipc/storage-ipc.ts`, and the login-item and config-folder handlers land in a new `apps/desktop/src/main/ipc/system-ipc.ts` with Electron injected.
- An `applySettings` seam on the storage context applies the document after every successful save and at boot.
- Rows that drive machinery the repository lacks render as unavailable and name what they wait for. On Linux the launch-at-login row doesn't render at all.

## Locked decisions

The brainstorm settled every decision below, and this document records them so later phases don't reopen them.

### Maintainer decisions

- **Base UI underpins the shared layer.** `@base-ui/react` 1.6.0 becomes the base of the shared components. Many more components arrive as screens progress, and the project's presentational components will sit on this base. That reason overrides the You Aren't Gonna Need It (YAGNI) objection that four primitives don't justify a dependency.
- **`launchAtLogin` is a stored schema field.** Displayed truth still comes from the operating system query. The flag records intent, and a later Linux implementation would write it.
- **Absent and unavailable mean different things.** On Linux the launch-at-login row doesn't render at all, because the platform will never support it. In an unpackaged development build the row renders as unavailable and names the development build as the reason. Absent means never. Unavailable means not right now.
- **The sidebar gains a System group.** Settings sits in it now, and Usage joins the group when it exists.
- **The column flexes and the window gains a floor.** The column reads `w-full max-w-[560px]` and centers in the content area. `apps/desktop/src/main/windows/window-options.ts` gains a minimum size near 720 by 500, because the window carries none today and a fixed column tears below 850 pixels.
- **Command-comma opens the window it needs.** With the tray showing and no window open, the shortcut creates the window, routes to the settings surface, moves the sidebar selection, and lands focus on the first control. A shortcut this ingrained reads as a hang when nothing answers it.
- **The reveal label follows the platform.** macOS reads "Reveal in Finder," Windows reads "Show in Explorer," and Linux reads "Open folder." `shell.openPath` stays, because it's the only variant that surfaces its failure, and a Windows reader never meets a macOS word.
- **`TextField` moves to the shared layer.** `apps/desktop/src/renderer/src/pages/providers/ui/text-field.tsx` carries no business logic and matches the user-interface kit shape, so it joins `shared/ui` and rebuilds on the same base as the new controls. Leaving it would seed two input languages on day one. `AccountKindField` stays in its page and recomposes on the shared primitives, because it holds account-kind knowledge rather than presentation. `EmptyState` stays, because it's page copy.

### Project-level decisions

These two predate the change and come from the project's brainstorm notes.

- **One scrollable grouped page.** The screen lives in the content area with no category rail and no separate Preferences window. Command-comma focuses this surface.
- **The token requirement ships off by default and stays visible.** "Require API token" never hides, and the token row appears only while the requirement is on. recompose fronts paid accounts, so serving on a local network without a token is quota theft.

### Converged decisions

All three candidate approaches arrived at the same answers below.

- **One query, one mutation.** One `['settings']` query flows through `settings:get`. The route loader warms it with `ensureQueryData`, and the page reads it with `useSuspenseQuery`. One whole-document mutation flows through `settings:save` and carries `scope: { id: 'settings' }`, so concurrent writes serialize instead of clobbering each other. The mutation computes its patch from the cache at execution time, not capture time.
- **Optimistic update with rollback.** A switch must move on click. On failure the control returns to the stored value, and the row grows a `role="alert"` line.
- **The port field holds a local draft.** It commits on blur or Enter, reverts on Escape, and validates against the contract schema before any channel call. The accepted range renders from the schema, so the copy can't drift.
- **Theme applies in the main process.** `nativeTheme.themeSource` carries the choice, set before window creation at boot, so no wrong-theme flash occurs. The renderer needs no CSS change, because every token in `apps/desktop/src/renderer/src/app/styles/theme.css` already reads as `light-dark(...)`.
- **The token lives in the vault under a fixed ref.** Main mints it as `'rc-local-' + randomBytes(32).toString('base64url')`, masks it to the prefix plus the last four characters, and hands the renderer only the mask.
- **Copy only, no reveal.** Main reads the secret and writes it to the clipboard through an injected clipboard port. The plaintext never crosses the bridge, so no DOM node, screenshot, or screen share can hold it.
- **Turning the requirement off keeps the token.** `deleteSecret` never runs for the token ref, so the guarantee holds by structure rather than by discipline.
- **Regeneration confirms inline.** A two-phase confirmation names its consequence, places focus on the safe default, and cancels on Escape. The design builds no dialog primitive.
- **Waiting rows carry no schema field.** The four rows that wait on machinery render with `aria-disabled="true"`, stay in the tab order, and wire their reason through `aria-describedby`. A keyboard or screen-reader user reaches the row and hears why it can't move.
- **The migration engine gains a progress guard first.** `migrateDocument` in `packages/contracts/src/migration.ts` loops forever on a step that fails to advance the version. A guard lands test-first before the first real migration exists.
- **Handlers split by plumbing.** Token handlers join `apps/desktop/src/main/ipc/storage-ipc.ts`, because the vault plumbing already lives there. Login-item and config-folder handlers go to a new `apps/desktop/src/main/ipc/system-ipc.ts` with Electron injected.
- **`shell.openPath` wins over `showItemInFolder`.** It matches the spec wording, and it's the only variant that surfaces its failure.
- **An `applySettings` seam applies the document.** It runs on the storage context after every successful save and at boot, consuming the `initializeStorage` result that its caller discards today.

## Layout contract

The branch records no row height, no spacing, and no control size, so the build would improvise them. This section fixes them.

- **Column and window.** The column reads `w-full max-w-[560px]` and centers in the content area. The window gains a minimum near 720 by 500.
- **Row.** 44 pixels tall at rest. The label sits at the 13 pixel body size, and the description sits at 11 pixels in the tertiary ink token.
- **Control.** 22 to 28 pixels tall, which matches macOS density. Base UI ships its primitives unstyled, so nothing lands correct by default.
- **Rhythm.** 20 points between groups and 8 points within one. Hierarchy comes from space rather than from smaller type. The 9 pixel overline stays a section-heading voice and never carries a reason or a status.
- **Telemetry keeps the full row anatomy.** A label, a static right-aligned value reading None, and a description stating that recompose never phones home. An empty control slot would read as a control that failed to load.
- **The token row sits under its switch.** It animates height and opacity on entry and respects reduced motion. The confirmation swaps the action cluster for the consequence sentence, Cancel taking focus, and a red Regenerate, because red marks a destructive act.
- **Live rows sort before waiting rows** inside a section where the logic allows: theme before reduced wire motion, config folder before log retention. Server keeps its port, bind address, and token order, because bind address and the token switch read as one local-network cluster.

## Design-system gap analysis

The design reference asks for more than the repository supplies today. Each gap below names the verified state and what closes it.

### The shared component layer doesn't exist

`apps/desktop/src/renderer/src/shared/` holds only `api/` and `testing/`. The design reference asks for a switch, a segmented control, a numeric field, and a grouped row, and no shared segment owns them. The closest precedent, `apps/desktop/src/renderer/src/pages/providers/ui/text-field.tsx`, belongs to one page.

What closes it: a new `shared/ui` segment built on `@base-ui/react`, with its own `index.ts` public API and a story per control. The settings page imports every control, so the no-orphans rule holds. The segmented control builds on the radio group primitive, and the numeric field keeps a text input with a numeric input mode.

### The app has no path to apply a theme choice

`apps/desktop/src/renderer/src/app/styles/main.css` sets `color-scheme: light dark` on the root elements and offers no override. The `scheme-light` and `scheme-dark` classes exist only in `apps/desktop/.storybook/preview.css`, so only Storybook can force a scheme today.

What closes it: `nativeTheme.themeSource` in the main process. Every token in `apps/desktop/src/renderer/src/app/styles/theme.css` already reads as `light-dark(...)`, so the renderer changes nothing and Storybook keeps its class mechanism.

### No tray template asset exists

`apps/desktop/resources/` holds one runtime icon, `icon.png`, and it's not a template image. A macOS tray needs template images whose filenames end in `Template`, at 16 by 16 pixels with a 32 by 32 `@2x` variant, and Windows prefers an `.ico`.

What closes it: new tray assets under `apps/desktop/resources/`, template variants for macOS and an `.ico` for Windows.

### The visual reference lives outside the branch

`.gitignore` excludes `design-system/`, so git doesn't track the folder and this branch can't carry the settings mock. Review can't diff against it.

What closes it: this document records the layout contract, the four sections, the row anatomy, and the mask shape. The Mobbin references in `openspec/changes/settings-screen/discovery/design-references.md` stay reachable as live links, and the three-platform visual baselines under `apps/desktop/e2e/` become the tracked reference once the screen lands.

### No design token covers the unavailable state

`apps/desktop/src/renderer/src/app/styles/theme.css` carries the card surface, the subtle line, the card radius, the overline type, and the accent. It carries nothing for an inert control.

What closes it: one semantic token for the unavailable state, written as `light-dark(...)` beside its neighbors, per the add-the-semantic-line rule in Architecture Decision Record (ADR) 0009.

### No feedback or confirmation primitive exists

The reference screens confirm a copy and a regeneration, and they gate regeneration behind a dialog. The repository has no toast machinery and no dialog primitive.

What closes it: row-local status text answers the feedback need, and the inline two-phase confirmation answers the dialog need. The design builds neither a toast system nor a dialog primitive.

## Capabilities

### New capabilities

- `settings`: the app presents every stored setting on one screen, applies a change without a save action, and refuses to offer a control whose machinery doesn't exist.

### Modified capabilities

None.

## Impact

- The settings schema gains a version. Every reader of a version 1 document goes through the migration, and the progress guard lands before the first step.
- The renderer grows a shared component layer and its first outside dependency, `@base-ui/react`. Later screens inherit both rather than repeating the primitives.
- A menu bar tray changes how the app quits, because a tray keeps the app alive after the last window closes. The tray menu carries an explicit Quit item for that reason.
- Four rows from the design reference ship as unavailable: bind address, gateway autostart, log retention, and reduced wire motion. The first three wait on an engine the repository lacks, and the fourth waits on the canvas, which renders a placeholder today.
- The launch-at-login row varies by platform: absent on Linux, and unavailable in an unpackaged development build.
- The Base UI adoption, the Linux login-item stance, and the `shell.openPath` choice each land as an ADR.
