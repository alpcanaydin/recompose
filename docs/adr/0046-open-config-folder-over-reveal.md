# 0046: The config folder opens through shell.openPath

**Status**: Accepted
**Date**: 2026-07-29

## Context

The settings screen's Data section names the folder that holds the settings document and the vault, and it offers an action that opens it. Electron ships two calls that could serve the row, and they differ in more than wording.

`shell.showItemInFolder(fullPath)` opens the parent folder of an item and selects it. The call returns nothing, so a failure produces no signal a handler could read.

`shell.openPath(path)` returns a promise that resolves to an empty string on success and to an error message on failure.

The two documents that drive this change disagreed. The proposal's first draft said "a call that reveals a folder in Finder," and the spec scenario says the operating system file browser opens at that folder. Those sentences name different calls.

A third pressure comes from the clean-code rules this repository enforces: no silent failures, and every error carries the attempted operation and the reason.

## Decision

`system:open-config-folder` calls `shell.openPath`.

The handler in `apps/desktop/src/main/ipc/system-ipc.ts` awaits an injected `openFolder` port, which `apps/desktop/src/main/index.ts` binds to `shell.openPath`. A non-empty resolved string becomes a typed failure under the `folder-open-failed` code. That code joins the result envelope of Architecture Decision Record (ADR) 0018. Its message reads `could not open the config folder:` followed by what the platform reported. An empty string returns success. Nothing throws across the bridge.

That choice matches the spec's wording and satisfies the no-silent-failures rule at the same time. `showItemInFolder` could satisfy neither: it selects the folder inside its parent rather than opening it, and a failed call and a successful one look identical from the main process.

The action label follows the platform. `fileBrowserFor` in `apps/desktop/src/main/system/file-browser.ts` maps `darwin` to `finder`, `win32` to `explorer`, and every other platform to `file-manager`, and that enum crosses the bridge inside `systemStateSchema.fileBrowser`. The row reads its label from the enum. The locked wording gives macOS "Reveal in Finder," Windows "Show in Explorer," and Linux "Open folder," so a Windows reader never meets a macOS word. Linux names a role rather than a product, because the desktop environment decides which file manager answers.

Main derives the enum from `process.platform`, so the platform string stays in the main process and the renderer switches over three closed values.

## Alternatives

- **`shell.showItemInFolder`.** Rejected on two counts. It reports no failure at all, which the no-silent-failures rule forbids for an action a person can watch fail. It also selects an item in the parent window rather than opening the folder, which contradicts the behavior the spec scenario describes.
- **Sending `process.platform` across the bridge and picking the word in the renderer.** Rejected because it scatters platform knowledge through the renderer and admits values outside the three shipped targets. The closed enum lets the compiler check that every branch exists.
- **One label for every platform.** Rejected because whichever word wins, two thirds of the people reading it meet a term their operating system doesn't use.
- **Opening the settings file rather than its folder.** Rejected because the row exists so a person can reach the vault, the quarantine copies, and the settings document together.

## Consequences

- The error set in `packages/contracts/src/ipc.ts` grows a `folder-open-failed` code, and the Data row renders the message it carries rather than swallowing it.
- The Data row's copy varies across the three platforms, so the visual baselines differ there. The acceptance run asserts the resolved string is empty rather than asserting a window appeared.
- `openPath` hands the folder to whatever the desktop registers as its handler for a directory. On Linux that varies by environment, which is why the third enum value names a role rather than a product.
- A later action that opens a file rather than a folder inherits the same shape: an injected port, a resolved string, and a typed failure code. Nothing in this record binds it to the config folder.
