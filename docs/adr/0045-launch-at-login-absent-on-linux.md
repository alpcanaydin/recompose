# 0045: Launch at login never renders on Linux

**Status**: Accepted
**Date**: 2026-07-29

## Context

The settings screen's General section carries a "Launch at login" row. Electron supplies `app.setLoginItemSettings` and `app.getLoginItemSettings`, and both cover macOS and Windows alone. The Linux request, electron/electron#15198, sits closed under a `status/wontfix` label. recompose ships to all three platforms, so the gap is real rather than a documentation nuance.

The screen already distinguishes two states for a control whose machinery the repository lacks. A row can render inert, which keeps it visible, focusable, and unmovable while it names what it waits for. Bind address, gateway autostart, log retention, and reduced wire motion all take that shape. The question this record settles is whether the Linux login-item row joins them.

A second platform question sits beside it. A login item created from `pnpm dev` records the path in `process.execPath`, which for an unpackaged build points at the Electron binary rather than at recompose. Writing one from a development build produces a login item that launches the wrong program.

## Decision

The row never renders on Linux, and it renders inert in an unpackaged build.

`loginItemAvailabilityFor` in `apps/desktop/src/main/system/login-item.ts` answers its whole input domain with three values. Anything other than `darwin` or `win32` returns `unsupported`. A `darwin` or `win32` build returns `unpackaged` when `app.isPackaged` is false, and `available` otherwise. The value crosses the bridge inside `systemStateSchema.loginItem`, so the renderer switches over a closed set and the platform string never reaches it.

`unsupported` means the row is absent. `unpackaged` means the row renders inert and names the development build as its reason. The difference carries meaning the maintainer locked in the proposal: absent says the platform will never support this, and inert says not right now. A Linux reader who sees no row learns something true. A Linux reader who sees a greyed row learns something false, and waits for a release that isn't coming.

`createLoginItem` enforces the same rule below the screen. Its `setEnabled` returns without touching the operating system unless availability reads `available`, so an inert or absent row can't reach `setLoginItemSettings` even through a mistake upstream.

`launchAtLogin` stays a stored field in the version 2 settings schema at `packages/contracts/src/settings.ts`. It records intent rather than observed truth, the row reads its displayed state from `getLoginItemSettings` on every `system:get`, and a later Linux implementation would find the field already there.

## Alternatives

- **The `auto-launch` package.** Rejected on three measurements. Its last stable release, 5.0.6, published on 2023-05-18, which predates this repository. A `6.0.0-rc1` has sat unreleased since 2024-02-27. Most damaging, it derives the executable path from `process.execPath`, which is the wrong value under an AppImage, where the correct one is `process.env.APPIMAGE`. Issues 48 and 85 on that repository record the resulting breakage on the exact Linux targets `apps/desktop/electron-builder.yml` builds.
- **A hand-written freedesktop autostart writer.** The discovery brief recommended it. A `.desktop` file under `$XDG_CONFIG_HOME/autostart`, per the Desktop Application Autostart Specification version 0.5, with `Hidden=true` as the per-user off switch. About 40 lines against an injected filesystem. Rejected by the maintainer's locked decision. An unwritten platform integration is absent, and absent is what the row shows.
- **Rendering the row inert on Linux.** The acceptance brief recommended this, and the maintainer overruled it. Inert means not right now. This is never, and the two states must keep meaning different things or neither one means anything.
- **Dropping `launchAtLogin` from the schema on Linux.** Rejected because the field records intent rather than platform capability. A conditional field would also break the single strict object the settings document parses as.

## Consequences

- The General section holds one row fewer on Linux than on macOS and Windows. The three-platform visual baselines under `apps/desktop/e2e/` differ there by design, and the Linux baseline pins the absence.
- A person on Linux who wants recompose at login uses the autostart tool their desktop environment ships. The application offers no path of its own and claims none.
- The acceptance scenario that drives the login item runs on macOS and Windows alone, and its fixture reads the prior value and restores it in teardown so a developer machine keeps its own setting.
- Electron adding Linux support supersedes this record rather than amending it. The stored field, the closed enum, and the `createLoginItem` guard all stay; only `loginItemAvailabilityFor` changes.
- Contributors running `pnpm dev` meet the inert row and its reason. That state is the honest one, because the login item a development build would write points at the wrong binary.
