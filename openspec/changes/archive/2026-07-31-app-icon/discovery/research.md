# Discovery brief: app icon (tier standard)

Scope note: `openspec/changes/app-icon/` was not on disk in this worktree at research time (reads of `openspec/changes/app-icon/proposal.md`, `openspec/AGENTS.md` and `openspec/project.md` all returned "file does not exist"). The brief is therefore grounded in the packaged-build code path and vendor documentation rather than a draft proposal. `cspell.json` line 21 ignores `openspec/changes/**/discovery`, so this brief belongs at `openspec/changes/app-icon/discovery/`.

---

## 1. Where the repository stands

Every icon the product ships today is the stock electron-vite scaffold artwork (the Electron logo on a dark rounded square). Verified by reading the files:

- `apps/desktop/build/icon.png` (512x512, Electron logo)
- `apps/desktop/build/icon.icns` (present, binary)
- `apps/desktop/build/icon.ico` (present, binary)
- `apps/desktop/resources/icon.png` (same Electron logo, imported by `apps/desktop/src/main/windows/main-window.ts` line 5 as `?asset`)
- `apps/desktop/resources/tray.png`, `trayTemplate.png`, `trayTemplate@2x.png` (loaded by `apps/desktop/src/main/tray/menu-bar-tray.ts` lines 5-7)

`apps/desktop/electron-builder.yml` declares `directories.buildResources: build` (line 4) and carries **no `icon` key at all** under `mac`, `win`, `linux` or `dmg`. Every icon is therefore resolved by electron-builder's implicit discovery.

Relevant runtime facts:

- `apps/desktop/src/main/windows/window-options.ts` line 21 passes `icon` to `BrowserWindow` **only on Linux**. macOS and Windows take the window/dock/taskbar icon from the bundle and the executable.
- `apps/desktop/src/main/index.ts` line 158 calls `electronApp.setAppUserModelId('sh.recompose.app')`, which matches `appId: sh.recompose.app` in `apps/desktop/electron-builder.yml` line 1. That pairing is what Windows needs for shortcut and taskbar identity.
- `apps/desktop/package.json` has **no `desktopName` field**, and `apps/desktop/electron-builder.yml` does not set `linux.syncDesktopName`. See risk 5.4.
- There is no ADR for icons or brand assets. `docs/adr/README.md` runs to 0054; the nearest neighbours are 0008 (Liquid Glass window chrome), 0009 (design tokens), 0035 (release operations) and 0043 (Apple interface conformance). A new ADR is required by `CLAUDE.md`.

---

## 2. How electron-builder 26.15.3 actually resolves icons

The repository pins `electron-builder` 26.15.3 (`apps/desktop/package.json` line 72, confirmed against `node_modules/.pnpm/node_modules/app-builder-lib/`). The published docs at electron.build track a newer line, so every claim below was verified against the installed code rather than the website. Vendor source paths are given relative to `node_modules/.pnpm/node_modules/app-builder-lib/`.

**Discovery order** (`out/util/iconConverter.js`, `buildSourceCandidates`, lines 95-132). With no configured icon, candidates are probed against `build/` then the project directory:

| Output format   | Probe order                                                        |
| --------------- | ------------------------------------------------------------------ |
| `icns` (macOS)  | `icon.icns`, `icons/`, `icon/`, `icon.png`, `icon.svg`             |
| `ico` (Windows) | `icon.ico`, `icons/`, `icon/`, `icon.png`, `icon.svg`, `icon.icns` |
| `set` (Linux)   | `icons/`, `icon/`, `icon.png`, `icon.svg`, `icon.icns`, `icon.ico` |

**Trap worth calling out first.** `icon.icns` and `icon.ico` are probed _before_ `icon.png`, and a source whose extension already matches the output format is returned untouched with no re-encoding (`out/util/iconConverter.js` lines 190-207). Because `apps/desktop/build/icon.icns` and `apps/desktop/build/icon.ico` both exist, replacing only `build/icon.png` would leave the Electron logo shipping on macOS and Windows. All three stock files have to go.

**Size floors, enforced with a hard error** (`out/util/iconConverter.js` lines 199-201 and 249-254): `icns` needs at least 512x512, `ico` and `set` at least 256x256, raised as `ERR_ICON_TOO_SMALL`. An existing `.ico` is parsed and must declare a 256 entry.

**SVG is a first-class source in 26.15.3.** `.svg` appears in the candidate list, is rasterised at 1024 px for `icns` and `ico` (line 243), and for Linux `set` is returned unrasterised so the target can place it in `scalable/` (lines 184-187).

**The conversion tool is downloaded at build time.** `out/toolsets/icons.js` fetches `icons@1.1.0` from `electron-userland/electron-builder-binaries`, cached under `ELECTRON_BUILDER_CACHE`, overridable with `ELECTRON_BUILDER_ICONS_TOOLSET_DIR`. Today's build never invokes it, because every platform resolves a source that already matches its output format. Moving to an SVG or PNG-only source adds this network fetch to all three release runners. ([offline cache workflow](https://www.electron.build/docs/troubleshooting/))

**Linux today ships exactly one icon size.** `build/icon.png` matches the `set` output extension, so it is returned as-is: a single 512x512 PNG, no hicolor ladder. A directory of `NxN.png` files or an SVG produces the full set (`out/util/iconConverter.js` lines 149-175, 63-78).

---

## 3. macOS: the Icon Composer decision

### What Apple ships

Apple's `.icon` format (Icon Composer, introduced with the Liquid Glass design language) is documented first-party in [Creating your app icon using Icon Composer](https://developer.apple.com/documentation/xcode/creating-your-app-icon-using-icon-composer). Key requirements quoted from that page:

- Source layers export as **SVG where possible, PNG as fallback**; "Because SVG format doesn't preserve fonts, convert text to outlines"; "Don't export the canvas mask because the system applies that automatically".
- Canvas is **1024 x 1024 px** for iPhone, iPad and Mac.
- Layers organise into **a maximum of four groups**, rendered back to front.
- Effects belong in Icon Composer, not the source art: "Remove blurs and shadows, and specular, opacity, and translucency settings" and "Remove background colors and gradients".
- One `.icon` file covers default, dark and mono appearances, with clear and tinted previewable from mono.

Apple's Human Interface Guidelines "App icons" page renders client-side and returned no body text to two fetch attempts, so no HIG rule is cited here. Treat HIG specifics as unverified until pulled through the `hig` MCP server.

### What electron-builder does with it

Support landed in app-builder-lib **26.2.0**, "feat: support Icon Composer icons for macOS" ([CHANGELOG](https://github.com/electron-userland/electron-builder/blob/master/packages/app-builder-lib/CHANGELOG.md)), from [PR #9279](https://github.com/electron-userland/electron-builder/pull/9279) merged 10 Nov 2025, closing [#9254](https://github.com/electron-userland/electron-builder/issues/9254) (opened 22 Aug 2025) and [#9278](https://github.com/electron-userland/electron-builder/issues/9278) (opened 17 Sep 2025). 26.15.3 is well past that line.

The installed option doc is unambiguous (`out/options/macOptions.d.ts` lines 30-36):

```
The path to application icon.
Accepts `.icns` (legacy) or `.icon` (Icon Composer asset).
If a `.icon` asset is provided, it will be preferred and compiled to an asset catalog.
@default build/icon.icns
```

Mechanics verified in `out/macPackager.js` `applyCommonInfo` (lines 354-391) and `out/util/macosIconComposer.js`:

1. `actool --version` is parsed and **must report 26.0.0 or higher**, otherwise the build fails with "Install Xcode 26 or higher to get a supported version of actool" (`macosIconComposer.js` lines 11-38).
2. `actool` compiles the `.icon` with `--target-device mac --minimum-deployment-target 26.0` and emits **both** `Assets.car` and a compatibility `Icon.icns` (lines 68-96).
3. The packager writes `Contents/Resources/Assets.car` and sets `CFBundleIconName = "Icon"`, **and separately** writes `Contents/Resources/icon.icns` with `CFBundleIconFile = "icon.icns"` from that same compatibility icns.

That last point is the decisive trade-off resolver: one `.icon` file yields both the Tahoe layered icon and the pre-Tahoe fallback. No hand-maintained second `.icns` is needed for the app bundle.

### CI viability

`.github/workflows/release.yml` line 19 builds on `macos-latest`. GitHub began pointing `macos-latest` at `macos-26` on **15 June 2026**, completing by 15 July 2026 ([actions/runner-images #14167](https://github.com/actions/runner-images/issues/14167)), and the default Xcode on that image moved to **26.6 starting 21 July 2026** ([#14344](https://github.com/actions/runner-images/issues/14344)). The actool 26+ requirement is therefore already satisfied on today's release runner. Because that satisfaction arrived through a label migration rather than an explicit pin, pinning the macOS release job to `macos-26` is cheap insurance.

---

## 4. Windows and Linux

### Windows

Microsoft's [Construct your Windows app's icon](https://learn.microsoft.com/en-us/windows/apps/design/style/iconography/app-icon-construction) (`ms.date` 2026-07-21, updated 2026-07-27) states the Win32 minimum plainly: "Apps should have, at the bare minimum: 16x16, 24x24, 32x32, 48x48, and 256x256. This covers the most common icon sizes, and by providing a 256px icon, ensures Windows should only ever scale your icon down, never up." The page also notes icons look best on a transparent background, and that Windows looks for an exact size match first before scaling the next size up down.

electron-builder embeds `win.icon` into the executable, so the taskbar and Explorer icon follow from `build/icon.ico`. NSIS installer and uninstaller icons default to the same app icon; `apps/desktop/electron-builder.yml` sets no `nsis.installerIcon`, so no extra asset is required.

### Linux

- The generated `.desktop` entry sets `Icon=<executableName>`, that is `Icon=recompose` (`out/targets/LinuxTargetHelper.js` line 268 with `linux.executableName: recompose` at `apps/desktop/electron-builder.yml` line 28).
- Linux icon sources are `linux.icon`, then `mac.icon` or the top-level `icon`, with any `.icon` path filtered out because it is macOS-only (`LinuxTargetHelper.js` lines 165-181, `out/platformPackager.js` lines 670-684). Setting `mac.icon` to a `.icon` file therefore does not break Linux; resolution falls through to `build/icon.png`, `build/icon.svg` or `build/icons/`.
- A manual set uses filenames matching `NxN.png` or `N.png` (`iconConverter.js` line 159). electron-builder's docs recommend 16, 24, 32, 48, 64, 96, 128, 256, 512.
- The [freedesktop Icon Theme Specification](https://specifications.freedesktop.org/icon-theme/latest/) requires at minimum a 48x48 PNG in `hicolor/48x48/apps` named to match the `Icon=` key, with an SVG in `hicolor/scalable/apps` covering all sizes; 256x256 is what GNOME uses in the app grid.
- The [AppImage AppDir specification](https://docs.appimage.org/reference/appdir.html) requires a root-level `.DirIcon`, which "SHOULD be a 256x256 PNG file", with the filename of the icon matching the `Icon=` key and the key itself carrying no extension.

---

## 5. Risks, conflicts and thin evidence

**5.1 The published docs are ahead of the pinned version.** [electron.build/docs/linux](https://www.electron.build/docs/linux/) documents `linux.syncDesktopName` as "removed in v27", but 26.15.3 still gates the installed `.desktop` filename on that flag (`LinuxTargetHelper.js` lines 203-219). The docs also name the toolset override `ELECTRON_BUILDER_ICONS_TOOLSET_PATH` while the installed code reads `ELECTRON_BUILDER_ICONS_TOOLSET_DIR` (`out/toolsets/icons.js` line 12). Verify anything from that site against `node_modules` before acting on it.

**5.2 The DMG caveat looks stale, but keep the belt.** [Icons and images](https://www.electron.build/docs/features/icons-and-images/) advises setting `dmg.icon` to an `.icns` explicitly when only a `.icon` is supplied. In 26.15.3, `dmg-builder`'s `computeDmgOptions` defaults `specification.icon` to `packager.getIconPath()` (`node_modules/.pnpm/node_modules/dmg-builder/out/dmg.js` lines 104-106), and `MacPackager.getIconPath()` returns the actool-generated compatibility icns for a `.icon` input (`out/macPackager.js` line 51, `out/platformPackager.js` lines 624-650). The volume icon should resolve on its own. I could not run a build to prove the end-to-end, so treat this as reasoned from source, not observed, and set `dmg.icon` anyway.

**5.3 Electron cannot load `.icon` at runtime.** [electron/electron#48476](https://github.com/electron/electron/issues/48476) (opened 6 Oct 2025, still open, labelled "enhancement" and "macos tahoe") asks for `.icon` support in `nativeImage` and `app.dock.setIcon()`. Any icon set from JavaScript stays PNG. This does not affect the bundle icon, which the system reads from `Assets.car`.

**5.4 Linux window association is already warning today.** electron-builder logs "electron uses desktopName as app_id / WM_CLASS for window association. Without it desktop environments may not link running windows to this .desktop entry" when `desktopName` is absent from package.json (`LinuxTargetHelper.js` lines 252-258). `apps/desktop/package.json` has no such field, so GNOME and KDE may show a generic icon for the running window even after the launcher icon is correct. Fixing this is in scope for "the app icon is right on Linux".

**5.5 Universal macOS builds.** `Assets.car` differs between architectures, which broke universal builds during PR #9279 review; 26.15.3 works around it by copying the x64 catalogue over the arm64 one before merging (`out/macPackager.js` lines 179-187). The repository does not build universal today, so this is dormant.

**5.6 actool version detection was reported flaky on macOS 15.** A contributor on PR #9279 saw empty `actool --version` output on macOS 15 while the build itself worked with Xcode 26 installed. Not reproducible on macOS 26 runners, but worth recognising if a local build on Sequoia fails at the version gate.

**5.7 No first-party Apple statement covers non-Xcode toolchains.** Apple documents the `.icon` to `Assets.car` path only through Xcode. That electron-builder's `actool` invocation plus `CFBundleIconName` produces a correct Liquid Glass icon rests on the electron-builder implementation and its test matrix, not on an Apple guarantee. Confidence is high, provenance is second-party.

---

## 6. Recommendation

Author one master vector at 1024 x 1024, then fan it out per platform:

1. **macOS.** Build an Icon Composer `.icon` from that master (background plus at most four foreground groups, effects applied in Icon Composer, not baked into the SVG). Commit it as `apps/desktop/build/icon.icon` and set `mac.icon: build/icon.icon` in `apps/desktop/electron-builder.yml`. One file yields the Tahoe layered icon plus the legacy `.icns` fallback. This also keeps the icon coherent with ADR-0008's Liquid Glass window chrome; a flat icns would sit oddly against the app's own glass surfaces. Set `dmg.icon` explicitly per 5.2.
2. **Delete the scaffold artwork.** Remove or replace `apps/desktop/build/icon.icns` and `apps/desktop/build/icon.ico`, and replace `apps/desktop/build/icon.png`. Leaving either legacy file behind silently keeps the Electron logo (section 2).
3. **Windows.** Commit `apps/desktop/build/icon.ico` containing 16, 24, 32, 48 and 256 layers, transparent background.
4. **Linux.** Commit `apps/desktop/build/icons/` with `NxN.png` at 16, 24, 32, 48, 64, 96, 128, 256, 512. A directory beats a single PNG (today's state ships one size) and beats an SVG for predictability, since it avoids the build-time toolset download entirely.
5. **Runtime assets.** Replace `apps/desktop/resources/icon.png` (the Linux `BrowserWindow` icon) and redraw the three tray PNGs. macOS tray art stays a template image, which `apps/desktop/src/main/tray/tray-icon.ts` already handles correctly.
6. **Linux window association.** Add `desktopName` to `apps/desktop/package.json` and `linux.syncDesktopName: true` to `apps/desktop/electron-builder.yml`, matching the value Electron reports as `app_id`.
7. **CI.** Pin the macOS leg of `.github/workflows/release.yml` to `macos-26` so the actool 26+ dependency is explicit rather than inherited from label drift.
8. **ADR.** Record the decision, including the Icon Composer build-machine dependency and the rejected `.icns`-only alternative.

**Rejected alternative: `.icns` only.** Cheaper (no Xcode or actool dependency, builds anywhere) but forfeits layering, dark, tinted and clear variants on macOS 26, and leaves the icon visually behind the shell it sits in. Given the release runner already carries Xcode 26.6, the cost of the preferred path is close to zero.

---

## 7. Acceptance criteria the pipeline can test

Bundle level, after `pnpm --filter @recompose/desktop run build:mac` / `build:win` / `build:linux`:

1. `recompose.app/Contents/Resources/Assets.car` exists and `Contents/Info.plist` carries `CFBundleIconName = Icon`.
2. `recompose.app/Contents/Resources/icon.icns` exists and `Contents/Info.plist` carries `CFBundleIconFile = icon.icns` (the pre-Tahoe fallback).
3. The DMG volume icon is not the default: `dmg.icon` resolves to a real `.icns`.
4. The Windows `.ico` header enumerates entries at 16, 24, 32, 48 and 256, and `recompose.exe` carries that icon as its embedded resource.
5. The `.deb` installs `/usr/share/icons/hicolor/<size>/apps/recompose.png` for every committed size, not just one.
6. The AppImage contains a root-level `.DirIcon`.
7. The generated `.desktop` entry has `Icon=recompose`, and `StartupWMClass` matches the value Electron reports as `app_id`.
8. No file under `apps/desktop/build/` or `apps/desktop/resources/` still matches the scaffold Electron artwork.

Build-log level (these are the vendor's own failure signals, so they are cheap and precise):

9. The build log contains no `application icon is not set` warning and no `default Electron icon is used` warning (`out/platformPackager.js` lines 653-682).
10. The build log contains no `desktopName is not set in package.json` warning (`LinuxTargetHelper.js` lines 252-258).
11. The macOS build does not fail the actool gate, which would read "Install Xcode 26 or higher to get a supported version of actool".

Test placement: `apps/desktop/e2e/packaged-smoke.spec.ts` already runs under the `packaged` Playwright project (`apps/desktop/e2e/playwright.config.ts` line 20) and already resolves the built app through `parseElectronApp(findLatestBuild(distDir))`. It is the natural home for criteria 1, 2, 4, 6 and 8 as filesystem and plist assertions on the packaged output.

---

## Sources

- [Icons and images, electron-builder docs](https://www.electron.build/docs/features/icons-and-images/) (undated; tracks a line ahead of the pinned 26.15.3, see risk 5.1)
- [Linux configuration, electron-builder docs](https://www.electron.build/docs/linux/) (undated; documents v27 behaviour for `syncDesktopName`)
- [Troubleshooting, electron-builder docs](https://www.electron.build/docs/troubleshooting/) (toolset cache and offline builds)
- [app-builder-lib CHANGELOG](https://github.com/electron-userland/electron-builder/blob/master/packages/app-builder-lib/CHANGELOG.md) (26.2.0 "feat: support Icon Composer icons for macOS")
- [electron-builder PR #9279](https://github.com/electron-userland/electron-builder/pull/9279) (merged 10 Nov 2025)
- [electron-builder issue #9254](https://github.com/electron-userland/electron-builder/issues/9254) (opened 22 Aug 2025, closed)
- [electron-builder issue #9278](https://github.com/electron-userland/electron-builder/issues/9278) (opened 17 Sep 2025, closed)
- [electron/electron issue #48476](https://github.com/electron/electron/issues/48476) (opened 6 Oct 2025, open)
- [Apple: Creating your app icon using Icon Composer](https://developer.apple.com/documentation/xcode/creating-your-app-icon-using-icon-composer) (undated)
- [Microsoft: Construct your Windows app's icon](https://learn.microsoft.com/en-us/windows/apps/design/style/iconography/app-icon-construction) (ms.date 2026-07-21, updated 2026-07-27)
- [freedesktop Icon Theme Specification](https://specifications.freedesktop.org/icon-theme/latest/)
- [AppImage AppDir specification](https://docs.appimage.org/reference/appdir.html)
- [actions/runner-images #14167, macos-latest moves to macos-26](https://github.com/actions/runner-images/issues/14167) (rollout from 15 June 2026)
- [actions/runner-images #14344, default Xcode 26.6](https://github.com/actions/runner-images/issues/14344) (from 21 July 2026)

Repository references (all verified by reading in this worktree): `apps/desktop/electron-builder.yml`, `apps/desktop/package.json`, `apps/desktop/build/icon.png`, `apps/desktop/build/icon.icns`, `apps/desktop/build/icon.ico`, `apps/desktop/build/after-pack.cjs`, `apps/desktop/resources/icon.png`, `apps/desktop/src/main/index.ts`, `apps/desktop/src/main/windows/main-window.ts`, `apps/desktop/src/main/windows/window-options.ts`, `apps/desktop/src/main/tray/menu-bar-tray.ts`, `apps/desktop/src/main/tray/tray-icon.ts`, `apps/desktop/e2e/playwright.config.ts`, `apps/desktop/e2e/packaged-smoke.spec.ts`, `.github/workflows/release.yml`, `docs/adr/README.md`, `cspell.json`.
