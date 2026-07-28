# Settings-screen proposal

## Why

recompose stores settings already. A schema holds the theme and the engine port, a store writes them to disk, and two channels carry them across the process boundary. None of it reaches the screen. Anyone who wants a different theme edits a JSON file by hand.

The settings screen closes that gap. It also forces the renderer's first shared component layer, because the design calls for switches, segmented controls, and numeric fields that no page owns yet.

## What changes

- A settings route and page slice land in the renderer as one grouped column across four sections: General, Server, Appearance, and Data.
- The shared layer gains its first components: a switch, a segmented control, a numeric field, and the grouped row that holds them.
- The settings schema moves to version 2 and gains the fields the screen writes. A migration carries a version 1 document forward.
- The main process picks up three integrations that Electron already offers: the login item, a menu bar tray, and a call that reveals a folder in Finder.
- A new channel mints the gateway token and hands it to the existing vault, so the token never travels beside the plain settings document.
- Rows that drive machinery the repository lacks render as unavailable and name what they wait for.

## Capabilities

### New capabilities

- `settings`: the app presents every stored setting on one screen, applies a change without a save action, and refuses to offer a control whose machinery doesn't exist.

### Modified capabilities

None.

## Impact

- The settings schema gains a version. Every reader of a version 1 document goes through the migration.
- The renderer grows a shared component layer. Later screens inherit it rather than repeating the primitives.
- A menu bar tray changes how the app quits, because a tray keeps the app alive after the last window closes.
- Four rows from the design reference ship as unavailable: bind address, gateway autostart, log retention, and reduced wire motion. The first three wait on an engine the repository lacks, and the fourth waits on the canvas, which renders a placeholder today.
