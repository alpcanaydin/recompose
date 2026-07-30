# App-icon solution design

## Header and change linkage

- Change id: app-icon
- Schema: recompose
- Proposal: [proposal.md](proposal.md)
- Specs: [specs/app-icon/spec.md](specs/app-icon/spec.md)
- Discovery: [discovery/research.md](discovery/research.md), [discovery/code-map.md](discovery/code-map.md), [discovery/shape-conventions.md](discovery/shape-conventions.md), [discovery/design-references.md](discovery/design-references.md), [discovery/mark.svg](discovery/mark.svg), [discovery/previews/](previews rendered during the brainstorm)
- Tasks: [tasks.md](tasks.md)

## Context

Every icon the packaged app ships is still the electron-vite scaffold artwork. The stock files sit at `apps/desktop/build/icon.png`, `build/icon.icns`, `build/icon.ico`, and `apps/desktop/resources/icon.png` (`discovery/research.md` section 1). `apps/desktop/electron-builder.yml` carries no icon key at all, so electron-builder resolves every icon by filename probing (`discovery/code-map.md`).

The gate 1 proposal locked the geometry, the palette treatment, the small-glyph masters, and the Recompose presentation rider. It deferred the exact bundle structure, the script contract, the container constants, and the test decomposition to this document. This design pins those, names every file, and maps the four approved feature files to checks.

Two boundaries shape everything here. First, `menu-bar-tray.ts` and `main-window.ts` sit on the coverage and mutation exclude lists, so no new logic lands in either (`apps/desktop/vitest.config.ts` lines 22 to 23, `apps/desktop/stryker.config.json` lines 12 to 13). Second, the macOS asset compiles through actool 26, which binds every machine that runs a mac packaging step (`discovery/research.md` section 3).

## Discovery inputs consumed

- `discovery/research.md` section 1: the four stock files and their consumers, which fixes the replacement inventory.
- `discovery/research.md` section 2: the probe order and the extension-match shortcut, which forces explicit icon keys and the deletion of all three `build/` stock files together.
- `discovery/research.md` section 2 size floors: `ERR_ICON_TOO_SMALL` binds at 512 for `.icns` sources and 256 for `.ico` and the Linux set, which the plan tables and a script guard encode.
- `discovery/research.md` section 3: the `.icon` compile mechanics, the actool 26 gate, and one compile yielding `Assets.car` plus the compatibility `.icns`, which shapes the maintainer's verification chain.
- `discovery/research.md` section 4: the Microsoft minimum ladder 16, 24, 32, 48, 256, which is the `.ico` plan.
- `discovery/research.md` section 5.1: the published docs outrun the pinned 26.15.3, so every builder claim here cites the installed code through the brief.
- `discovery/research.md` section 5.2: `dmg.icon` gets an explicit value as a belt.
- `discovery/research.md` section 5.3: Electron loads no `.icon` at runtime, so every runtime asset stays `.png`.
- `discovery/research.md` section 5.4: the missing `desktopName` warning, which adds the field and `linux.syncDesktopName`.
- `discovery/research.md` sections 5.5 to 5.7: consulted, no impact. No universal build exists, and the actool flake concerns macOS 15 machines this change never uses for packaging.
- `discovery/research.md` section 7: the acceptance list, which the packaged smoke additions and the unit-lane source assertions split between them.
- `discovery/code-map.md`, `electron-builder.yml` entry: the no-icon-key gap, which makes all four keys net-new.
- `discovery/code-map.md`, `build/icon.png` entry: the byte-identical pair with `resources/icon.png` (md5 `a2cf889708d9c4959c6808b4584848e4`), which the script's ownership of both copies and the scaffold-hash check close.
- `discovery/code-map.md`, `tray-icon.ts` entry: the platform split already encodes template-on-macOS, so the tray change is art only.
- `discovery/code-map.md`, `menu-bar-tray.ts` and `main-window.ts` entries: both excluded from coverage and mutation, so testable logic lands in pure siblings.
- `discovery/code-map.md`, `knip.json` and `cspell-words.txt` entries: the script registers in the knip entry list and new vocabulary lands in the accept list in the same diff.
- `discovery/code-map.md`, `packaged-smoke.spec.ts` entry: the packaged project is the only lane that can inspect a built bundle, so the artifact assertions land there.
- `discovery/code-map.md`, `visual.spec.ts` entry: baselines clip to the content rectangle, so no visual baseline moves.
- `discovery/code-map.md`, `docs/adr/README.md` entry: the last accepted record is 0054, so this decision set takes 0055.
- `discovery/shape-conventions.md`: the concentric rule, the Fluent radius at 2 pixels on the 48 grid, and the per-platform shape findings.
- `discovery/shape-conventions.md` items 4 and 5, consulted and superseded. The amendment at gate 1 replaced the blue small glyph with the cream note and dark contour (`proposal.md`, Locked decisions).
- `discovery/design-references.md`: the glyph-only discipline at small sizes and the one-glyph-many-tiles appearance discipline.
- `discovery/mark.svg`: the unflattened source. Its four gradients and its note gradient span, y 46 to 210 on the 256 grid, fix the flatten backdrops this design pins.
- `discovery/previews/`: the rejected straight-band rendering that produced the concentric rule.
- `.github/workflows/ci.yml` line 241: the e2e job runs `electron-builder --dir` on `macos-latest`, so the actool gate binds `ci.yml` as well as `release.yml`. The runner pin therefore covers both mac legs.

## Goals and non-goals

**Goals:**

- Every packaged artifact wears the recompose mark, and no shipped file matches the scaffold artwork.
- macOS 26 renders the icon from a hand-authored Icon Composer bundle, and one compile also yields the macOS 15 fallback.
- The bundle defines default, dark, and mono appearances with the note geometry identical across all three.
- The tray shows the note glyph alone on every platform, as an art swap with no logic change.
- One committed script renders every raster deterministically from two masters and one palette record.
- The app presents itself as Recompose, and the homebrew cask template moves with the name.

**Non-goals:**

- No renderer file changes and no Feature-Sliced Design layer takes part. The mark never renders in the DOM (`discovery/code-map.md`).
- No interface tokens for the brand palette. Architecture Decision Record (ADR) 0009's add-the-semantic-line rule covers any future interface use (`proposal.md`, gap analysis).
- No runtime icon calls. No `app.dock.setIcon`, and the dev dock keeps reading Electron.
- No scalable SVG rung in the Linux set. The Portable Network Graphics (PNG) ladder keeps builds off the icons-toolset download (`discovery/research.md` section 2).
- No signing or notarization changes. ADR 0035's phase A stays as it is.
- No user-data migration. The maintainer approved the folder move with none (`proposal.md`, rider).
- No change to the tray platform split or the window icon placement. `tray-icon.test.ts` and `window-options.test.ts` stay untouched.

## Constraints and invariants

- TypeScript runs at maximum strictness: `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`. The scripts join `tsconfig.node.json`, which extends `tsconfig.strict.json`.
- No `any`, no `as` casts to silence errors, no `@ts-ignore` or `@ts-expect-error` without a comment explaining why.
- Never write code comments. The sole exception is a constraint the code can't express.
- New scripts are TypeScript with an `.mts` extension, run by Node 24 directly, registered in `knip.json`, and wired into typecheck.
- No new logic in `src/main/tray/menu-bar-tray.ts` or `src/main/windows/main-window.ts`. Testable logic lives in pure sibling modules (`apps/desktop/vitest.config.ts`, `apps/desktop/stryker.config.json`).
- The proposal's locked decisions bind verbatim: the straight-cornered full-bleed master, the flatten-before-render rule, the concentric rule, the appearance discipline, the purpose-drawn small master, the small-entry cutoff, and the note-only tray.
- Test-first, always: red, green, refactor. Tests verify state, and doubles appear only at real process boundaries.
- Test code changes if and only if behavior changes. The application-menu label spec moves because the label moves. Nothing else moves.
- Node-side logic survives the diff-scoped Stryker gate at the existing break threshold of 81.
- Every technical decision lands in an ADR. This change writes 0055.
- `main` stays protected. One job, one branch, one pull request.
- Authored markdown passes Vale and cspell. Never use an em dash.

## Design

### The shape

Three masters and one record feed everything.

1. `build/mark.svg` is the flattened 1024 master: straight-cornered, full-bleed, solid fills only.
2. `build/mark-small.svg` is the purpose-drawn note for 16 and 24 point contexts.
3. `build/icon.icon` is the hand-authored Icon Composer bundle for macOS.
4. `scripts/brand-palette.mts` records the seven brand solids both the script and the bundle copy from.

The script `scripts/generate-icons.mts` renders every committed raster and container from the first two masters. electron-builder consumes four explicit keys and probes nothing. The rider renames the presentation to Recompose in the same `electron-builder.yml` diff.

### The palette and the flatten rule

`brandPalette` holds exactly seven entries, the source anchors the proposal names (`proposal.md`, gap analysis):

| Key           | Value     | Appears in                                                |
| ------------- | --------- | --------------------------------------------------------- |
| `tileTop`     | `#2640D9` | tile gradient start                                       |
| `tileBottom`  | `#142273` | tile gradient end                                         |
| `frameTop`    | `#0C1341` | dark band start, dark tile deepening, small-glyph contour |
| `frameBottom` | `#020309` | dark band end, dark tile deepening                        |
| `noteCream`   | `#F2EBD1` | note gradient start, small-glyph fill                     |
| `brandWhite`  | `#FFFFFF` | note gradient end, outer band start                       |
| `bandFade`    | `#AAA79C` | outer band end                                            |

The locked flatten rule composites each 0.8-opacity stop against its actual backdrop. The design pins the backdrops from `discovery/mark.svg`:

- dark band stops flatten over the tile gradient ends: `flattenOver(frameTop, tileTop, 0.8)` and `flattenOver(frameBottom, tileBottom, 0.8)`.
- outer band stops flatten over the flattened dark band beneath them: `flattenOver(brandWhite, frameTopFill, 0.8)` and `flattenOver(bandFade, frameBottomFill, 0.8)`.
- note stops flatten over the tile gradient sampled at the note gradient's span: `flattenOver(noteCream, tileSampleAt(46 / 256), 0.8)` and `flattenOver(brandWhite, tileSampleAt(210 / 256), 0.8)`.

`flattenedMarkFills` exports the six derived solids. A unit spec parses `build/mark.svg` and asserts its fills equal the anchors plus the derived set, so the master and the record can't drift. The same spec parses the `.icon` layer sources, closing the third copy.

### The geometry transforms

The master stays straight-cornered, so every rendition rebuilds the frame as nested filled rounded rectangles, back to front:

1. the outer rounded rectangle at the target radius, filled with the flattened outer band gradient,
2. a rectangle inset by 12/256 of the edge at radius `concentricRadius(outer, inset)`, filled with the flattened dark band gradient,
3. a rectangle inset by 24/256 at its concentric radius, filled with the tile gradient,
4. the note path, unchanged.

`concentricRadius(outerRadius, inset)` returns `max(outerRadius - inset, 0)`. The nested-fill construction paints the same picture as the master's stroked rectangles and makes each radius direct.

The shared Windows and Linux rendition uses `fluentOuterRadius(size)`, which is `size * 2 / 48`, the Fluent radius from `discovery/shape-conventions.md`. At that radius both band insets exceed the outer radius, so both inner radii floor at zero and only the outer edge rounds. The locked set names the dark band's floor. The light band floors by the same arithmetic.

`usesSmallGlyph(points)` returns true below 32 points. The 16 and 24 point entries everywhere render `mark-small.svg` instead of the tile rendition.

### The small master

`build/mark-small.svg` draws on a 1024 viewBox:

- stem weight at least 128 units, which renders 2 pixels at 16 and 3 pixels at 24,
- beam gap at least 96 units, which keeps the counter open at 1.5 pixels at 16,
- fill `noteCream` `#F2EBD1`, solid,
- contour `frameTop` `#0C1341` at 64 units, which renders 1 pixel at 16 and 1.5 pixels at 24,
- transparency behind everything.

The contour defines the shape on light panels and the cream carries it on dark ones, per the locked decision. The macOS tray template renders the same geometry as a full-alpha black silhouette, because the menu bar tint needs solid alpha.

### The `.icon` bundle

`build/icon.icon` is a directory bundle: `icon.json` at the root and layer sources under `Assets/`.

Layer inventory:

- `Assets/tile.svg`: the default background. The full-bleed tile gradient with both frame bands baked at concentric radii, flattened solids only.
- `Assets/tile-dark.svg`: the dark background. The tile gradient deepens toward `frameTop` and `frameBottom`, the dark band stays at its concentric radii, and the light outer band is absent.
- `Assets/note.svg`: the note glyph with flattened fills, identical in every appearance.

`icon.json` declares the 1024 canvas, a background group carrying the tile layers, a foreground group carrying the note, and three appearances:

- default shows `tile.svg` behind `note.svg`,
- dark shows `tile-dark.svg` behind the same `note.svg`,
- mono hides the background group and shows the note alone, and the system derives clear and tinted from it.

Apple's source rules apply: no baked canvas mask, no baked blur, shadow, or specular, and effects configured in Icon Composer only (`discovery/research.md` section 3). The band radii inside the tile layers run concentric to the system mask radius Icon Composer previews.

The maintainer's verification chain, on the Tahoe machine with Xcode 26:

1. **actool compile** proves the bundle parses and emits both `Assets.car` and the compatibility `.icns`, the same invocation electron-builder makes at package time.
2. **Icon Composer eyeball** proves the three appearances read as designed, the layers sit in the right groups, and the dark tile's deepening lands where intended.
3. **Dock-size glass-edge check** compares the icon side by side at dock size and proves the baked light band doesn't fight the mask's specular rim, the exact hazard the locked decision names.

### The volume icon

`build/volume.icns` carries the shared mark at the legacy macOS grid, because actool covers the bundle's own `.icns` and only the disk-image volume needs this file. Constants:

- 1024 canvas, tile 824 wide, centered, 100 units of transparent margin each side,
- outer corner radius 186 as a plain rounded corner, the approximation the locked decision accepts here,
- band insets at the master fractions of the tile edge: 38.625 and 77.25 units,
- concentric band radii about 147 and about 109.

Entry list, all PNG payloads: `icp4` (16), `icp5` (32), `ic11` (16 at 2x), `ic12` (32 at 2x), `ic07` (128), `ic13` (128 at 2x), `ic08` (256), `ic14` (256 at 2x), `ic09` (512), `ic10` (512 at 2x). The small-glyph cutoff runs on point size: `icp4` and `ic11` render `mark-small.svg`, and every 32-point-and-up entry renders the legacy-grid tile.

### The generation script

`scripts/generate-icons.mts` is the I/O shell. It reads `build/mark.svg` and `build/mark-small.svg`, applies the geometry transforms, rasterizes through `@resvg/resvg-js`, assembles the containers, and writes every output. The pure logic lives in `scripts/icon-geometry.mts`, `scripts/ico-container.mts`, and `scripts/icns-container.mts`.

Outputs, all committed:

- `build/icon.ico`: 16 and 24 as the small glyph, 32, 48, and 256 as the shared rendition.
- `build/icons/`: `NxN.png` at 16, 24, 32, 48, 64, 96, 128, 256, and 512, with the small glyph on the 16 and 24 rungs.
- `build/volume.icns`: as pinned above.
- `resources/icon.png`: the shared rendition at 512, the Linux window-frame icon.
- `resources/tray.png`: the cream contoured note at 32.
- `resources/trayTemplate.png` and `resources/trayTemplate@2x.png`: the full-alpha silhouette at 16 and 32.

Determinism guarantees: `@resvg/resvg-js` pins exactly, ships prebuilt per-platform binaries, and touches no system library or font. The masters carry no text. The container writers are pure functions of rendered bytes. Same inputs, same bytes, on any machine. The script fails with a named error on a missing master or an entry below its target floor, and it writes nothing partial.

Regeneration runs on demand, never at build time: `pnpm --filter @recompose/desktop run generate:icons`, backed by `"generate:icons": "node scripts/generate-icons.mts"` in `apps/desktop/package.json`. Every packaging target then resolves a committed source matching its output format, so release builds skip the icons-toolset download (`discovery/research.md` section 2).

### The builder configuration

`apps/desktop/electron-builder.yml` gains four explicit keys: `mac.icon: build/icon.icon`, `win.icon: build/icon.ico`, `linux.icon: build/icons`, and `dmg.icon: build/volume.icns`. `build/icon.png` and `build/icon.icns` leave without successors. `linux.syncDesktopName: true` lands beside them, and `desktopName: recompose` lands in `apps/desktop/package.json`, matching `executableName` and the `Icon=recompose` key (`discovery/research.md` section 5.4).

### The rider

The presentation rename rides the same `electron-builder.yml` diff, per the locked rider:

- `productName: Recompose` in `electron-builder.yml`.
- `app.setName('Recompose')` and `app.setAboutPanelOptions({ applicationName: 'Recompose' })` land at the top of `src/main/index.ts` module scope. They run before `resolveUserDataOverride` handling, which is the first path read, so the user-data folder follows the name.
- The application-menu label in `app-menu-template.ts` becomes `Recompose`, and its spec moves with it.
- The tray tooltip in `menu-bar-tray.ts` becomes `Recompose`. The tray menu's `Open recompose` and `Quit recompose` stay lowercase prose, so `tray-menu-template.ts` stays untouched.
- The cask template in `.github/workflows/homebrew-bump.yml` moves to `app "Recompose.app"` and `name "Recompose"`, because the hardcoded lowercase line breaks on the next release.

### The runner pins

`release.yml` builds its mac leg on `macos-latest`, and `ci.yml`'s e2e job runs `electron-builder --dir` on the same label (line 241). Both invoke actool once `mac.icon` points at the `.icon` bundle. Both matrices pin their mac entry to `macos-26`, turning the label-drift satisfaction into an explicit dependency (`discovery/research.md` section 3). The `ci.yml` Linux packaged step also swaps `--dir` for `--linux --publish never`, so the deb and AppImage exist for the artifact assertions.

## Data model and contracts

None. The only new record is `brandPalette`, a build-time constant. No entity, no state transition, no inter-process channel, and no storage contract changes, because no renderer or bridge file is in scope (`discovery/code-map.md`).

## Error handling

Every expected failure here is build-time, and none may pass without a report.

| Failure state                            | Raised by                                                          | How it surfaces                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| a master file missing or unreadable      | `generate-icons.mts` before any write                              | the script throws naming the file and writes nothing                            |
| a rendered entry below its target floor  | the script's floor guard against the 256 and 512 plan tops         | the script throws naming the entry and the floor, ahead of `ERR_ICON_TOO_SMALL` |
| an icon source below the builder's floor | electron-builder as `ERR_ICON_TOO_SMALL` (`research.md` section 2) | the packaging step fails, and the plan tables plus the unit specs prevent it    |
| actool below 26                          | the version gate in `macosIconComposer` (`research.md` section 3)  | the mac packaging step fails naming Xcode 26, contained by the runner pins      |
| a missing icon falling back to stock art | the builder's `default Electron icon is used` warning              | the scaffold-hash assertion fails the packaged lane, so the warning can't ship  |
| a missing `desktopName`                  | the builder's warning (`research.md` section 5.4)                  | the field lands in `package.json`, and the smoke asserts the `.desktop` fields  |

The script models no recoverable states. A generation failure has exactly one answer, fix the input and rerun, so every path throws with context rather than returning a typed result.

## File map

Every path sits outside Feature-Sliced Design, matching the code map.

### Masters and generated assets

- `apps/desktop/build/mark.svg`: the flattened 1024 master, normalized from `discovery/mark.svg` through the pinned flatten rule (create)
- `apps/desktop/build/mark-small.svg`: the purpose-drawn small note at the pinned weights (create)
- `apps/desktop/build/icon.icon/`: the hand-authored bundle, `icon.json` plus three layer sources (create)
- `apps/desktop/build/icon.ico`: the five-entry ladder, replacing the stock art (modify)
- `apps/desktop/build/icons/`: the nine-rung Linux ladder (create)
- `apps/desktop/build/volume.icns`: the disk-image volume icon at the legacy grid (create)
- `apps/desktop/build/icon.png`: leaves without a successor (delete)
- `apps/desktop/build/icon.icns`: leaves without a successor (delete)
- `apps/desktop/resources/icon.png`: the Linux window-frame icon at 512 (modify)
- `apps/desktop/resources/tray.png`: the cream contoured note at 32 (modify)
- `apps/desktop/resources/trayTemplate.png`: the silhouette at 16 (modify)
- `apps/desktop/resources/trayTemplate@2x.png`: the silhouette at 32 (modify)

### Scripts

- `apps/desktop/scripts/brand-palette.mts`: the seven-solid record (create)
- `apps/desktop/scripts/icon-geometry.mts`: concentric radii, the Fluent radius, the flatten arithmetic, the plan tables, the cutoff (create)
- `apps/desktop/scripts/icon-geometry.test.mts`: the geometry specs and properties (create)
- `apps/desktop/scripts/ico-container.mts`: the `.ico` encoder (create)
- `apps/desktop/scripts/ico-container.test.mts`: header round-trip specs (create)
- `apps/desktop/scripts/icns-container.mts`: the `.icns` encoder and the volume plan (create)
- `apps/desktop/scripts/icns-container.test.mts`: entry-type and payload specs (create)
- `apps/desktop/scripts/brand-consistency.test.mts`: master fills, `.icon` layer fills, and committed-output byte equality against a regeneration (create)
- `apps/desktop/scripts/generate-icons.mts`: the I/O shell (create)

### Configuration and main process

- `apps/desktop/electron-builder.yml`: `productName: Recompose`, the four icon keys, `linux.syncDesktopName` (modify)
- `apps/desktop/package.json`: `desktopName`, the `generate:icons` script, the exact-pinned `@resvg/resvg-js` (modify)
- `apps/desktop/tsconfig.node.json`: `scripts/**/*` joins the include list (modify)
- `apps/desktop/vitest.config.ts`: the unit include and coverage lists gain the scripts, minus the shell (modify)
- `apps/desktop/vitest.mutation.config.ts`: the include gains the script tests (modify)
- `apps/desktop/stryker.config.json`: mutate gains `scripts/**/*.mts` minus tests and minus the shell (modify)
- `knip.json`: the desktop entry list gains `scripts/generate-icons.mts` (modify)
- `cspell-words.txt`: the icon vocabulary the diff mints, such as `icns` and `hicolor` (modify)
- `apps/desktop/src/main/index.ts`: `app.setName` and the about panel, ahead of every path read (modify)
- `apps/desktop/src/main/menu/app-menu-template.ts`: the application-menu label becomes Recompose (modify)
- `apps/desktop/src/main/menu/app-menu-template.test.ts`: the label expectation moves with the behavior (modify)
- `apps/desktop/src/main/tray/menu-bar-tray.ts`: the tooltip becomes Recompose, art and label only (modify)

### Workflows, e2e, and records

- `.github/workflows/release.yml`: the mac matrix entry pins to `macos-26` (modify)
- `.github/workflows/ci.yml`: the e2e mac entry pins to `macos-26`, and the Linux packaged step builds the Linux targets (modify)
- `.github/workflows/homebrew-bump.yml`: the cask app and name lines move to Recompose (modify)
- `apps/desktop/e2e/packaged-smoke.spec.ts`: the artifact-level icon and presentation assertions (modify)
- `docs/adr/0055-app-icon-identity-and-recompose-presentation.md`: the decision set (create)
- `docs/adr/README.md`: the 0055 index row (modify)

## Interfaces

### Palette

- Consumes: nothing.
- Produces:
  - `export type BrandSolid = 'tileTop' | 'tileBottom' | 'frameTop' | 'frameBottom' | 'noteCream' | 'brandWhite' | 'bandFade'`
  - `export const brandPalette: Readonly<Record<BrandSolid, string>>`

### Geometry

- Consumes: `brandPalette`.
- Produces:
  - `concentricRadius(outerRadius: number, inset: number): number`
  - `fluentOuterRadius(size: number): number`
  - `flattenOver(foreground: string, backdrop: string, alpha: number): string`
  - `tileSampleAt(position: number): string`
  - `export const flattenedMarkFills: Readonly<Record<FlattenedStop, string>>` with `FlattenedStop` covering the six composited stops
  - `export const icoPlan: readonly number[]` as `[16, 24, 32, 48, 256]`
  - `export const linuxLadder: readonly number[]` as `[16, 24, 32, 48, 64, 96, 128, 256, 512]`
  - `usesSmallGlyph(points: number): boolean`

### Containers

- Consumes: rendered bitmaps and `.png` bytes from the shell.
- Produces:
  - `export type RasterImage = { size: number; rgba: Uint8Array }`
  - `encodeIco(images: readonly RasterImage[]): Buffer`
  - `export type IcnsEntry = { type: string; png: Uint8Array }`
  - `encodeIcns(entries: readonly IcnsEntry[]): Buffer`
  - `export const volumeIcnsPlan: readonly { type: string; points: number; scale: 1 | 2 }[]`

### Shell and build path

- Consumes: `@resvg/resvg-js`, the two masters, and every module above.
- Produces: the committed files in the file map, and no exports.
- `electron-builder.yml` consumes `build/icon.icon`, `build/icon.ico`, `build/icons`, and `build/volume.icns` through the four explicit keys.

### Main process

- Consumes: nothing new. `buildAppMenuTemplate(platform, onOpenSettings)` and the tray functions keep their signatures.
- Produces: the same exports with the Recompose labels.

## Decisions

### 1. macOS ships a hand-authored Icon Composer bundle

`build/icon.icon` lands as source, `mac.icon` points at it, and one actool compile yields both the Tahoe asset catalog and the macOS 15 `.icns` (`discovery/research.md` section 3). The repository never carries a hand-maintained second `.icns` for the bundle. The cost is a build-machine dependency: every mac packaging step needs actool 26, so both workflow mac legs pin to `macos-26`. Local mac packaging needs Tahoe with Xcode 26, which the maintainer's machine runs.

**Alternatives considered:** `.icns` only, rejected because it forfeits Liquid Glass, dark, tinted, and clear on macOS 26 and leaves the icon behind the shell ADR 0008 chose. Generating the `.icon` from the script, rejected because the format's appearance semantics come from human judgment, and the verification chain is manual anyway.

**ADR draft:** `docs/adr/0055-app-icon-identity-and-recompose-presentation.md`

### 2. The concentric rule is the single radius law

Every frame radius everywhere derives from `concentricRadius`: inner radius equals outer radius minus inset, floored at zero. The macOS tile bakes it against the system mask radius, the shared rendition against the Fluent radius, and the volume icon against the legacy-grid radius. One pure function, three call sites, one property test.

**Alternatives considered:** straight bands under the target masks, rejected on sight against the rendered previews (`discovery/previews/`, `discovery/shape-conventions.md`). Per-target hand-tuned radii, rejected because three unexplained constants can drift where one rule can't.

**ADR draft:** `docs/adr/0055-app-icon-identity-and-recompose-presentation.md`

### 3. One palette record with seven anchors, and derived fills everywhere else

`brandPalette` holds the seven source solids, `flattenOver` derives the six composited fills, and a spec asserts the master and the `.icon` layers match the derived set. The palette stays outside the interface token set, per the proposal's gap analysis: it has zero interface consumers, and the theme switching lives in the operating system.

**Alternatives considered:** recording the composited fills as literals, rejected because nobody can verify eight literals with hidden arithmetic, while seven anchors plus a pure function invite a spec. Minting semantic tokens in `primitives.css`, rejected as tokens with no consumer.

**ADR draft:** `docs/adr/0055-app-icon-identity-and-recompose-presentation.md`

### 4. The app presents as Recompose, and the cask moves in the same change

`productName`, `app.setName`, the about panel, the menu label, and the tray tooltip all move to Recompose. Same-file ownership of `electron-builder.yml` is the named reason the rename rides this change. The user-data folder follows the name with no migration, per the approved rider. The cask template in `homebrew-bump.yml` hardcodes `app "recompose.app"`, which the rename breaks on the next release, so its app and name lines move here too.

**Alternatives considered:** a separate rename change, rejected because two changes would own one file, which is the project's own serialization trigger. Keeping the old user-data path through `setPath`, rejected because it preserves a dead name forever to save a 151-byte document.

**ADR draft:** `docs/adr/0055-app-icon-identity-and-recompose-presentation.md`

### 5. Explicit icon keys replace filename probing

All four keys land even where probing would resolve correctly, including the `dmg.icon` belt (`discovery/research.md` section 5.2). Probing is what let the stock `.icns` and `.ico` outrank a replaced `.png` without a warning (`discovery/research.md` section 2). A named key fails with a clear error when its file goes missing.

**Alternatives considered:** keeping the filename convention, rejected because the probe order is the trap this change exists to close.

**ADR draft:** None. The mechanics are the vendor's, and 0055 records the outcome through decision 1.

### 6. Rasters land committed, and regeneration is an on-demand script

Outputs commit beside their masters, matching the pattern `build/` already follows. The byte-equality spec keeps the committed files honest: hand-editing any output fails the suite until the script regenerates it. Build time stays free of rendering, network fetches, and system tools.

**Alternatives considered:** rendering at package time, rejected because it adds the icons-toolset download and a nondeterministic tool to three release runners. A checked-in third-party icon pipeline, rejected because two vector inputs and two containers don't justify a dependency tree.

**ADR draft:** None.

### 7. The `.ico` encodes small entries as bitmaps and the largest as `.png`

Entries below 256 land as 32-bit `BGRA` device-independent bitmaps with an `AND` mask, and the 256 entry lands as PNG. Old shell surfaces predate PNG entries at small sizes, while 256 as PNG is the established composition Windows scales down from (`discovery/research.md` section 4). The encoder is pure, so a header round-trip spec pins the layout.

**Alternatives considered:** PNG payloads at every size, rejected because it trades a few kilobytes for a compatibility question this design doesn't need to ask.

**ADR draft:** None.

### 8. The gherkin stays the contract, and the packaged spec carries the assertions

The four feature files under `gherkin/app-icon/` remain the review contract. The scenarios a machine can judge land as plain assertions in `packaged-smoke.spec.ts`, titled after the scenarios they prove, because the packaged project runs plain Playwright with no bddgen wiring (`apps/desktop/package.json`, `test:e2e:packaged`). Scenarios no machine can judge, the glass edge and the tray tint, map to the maintainer walkthrough.

**Alternatives considered:** copying the features into `e2e/features/` with step definitions, rejected because the packaged lane runs plain Playwright and half the steps would assert nothing a process can observe.

**ADR draft:** None.

## Test matrix

| Layer          | What this layer proves (or why none)                                                                                                                                                                                                                                                                                                                                                                                                  | Check command                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Unit           | `concentricRadius` floors at zero and matches the rule at both boundaries. `fluentOuterRadius` yields 2 at 48. `flattenOver` returns the foreground at alpha 1 and the backdrop at alpha 0. The plan tables carry 256 and 512 at their tops and cut the small glyph below 32 points. `encodeIco` and `encodeIcns` round-trip their headers. The mark and `.icon` fills match the palette-derived set. The menu label reads Recompose. | `pnpm run test`                                          |
| Integration    | The whole pipeline regenerates into a temporary directory and byte-matches every committed output, proving the committed rasters and containers came from the masters, the palette, and the pinned renderer.                                                                                                                                                                                                                          | `pnpm run test`                                          |
| End-to-end     | On macOS: `Assets.car` exists, `CFBundleIconName` is `Icon`, `icon.icns` exists with `CFBundleIconFile`, and the bundle names itself Recompose. On Linux: the deb carries the hicolor ladder, the `.desktop` entry carries `Icon=recompose`, `StartupWMClass`, and the Recompose display name, and the AppImage carries `.DirIcon`. Everywhere: no shipped icon matches the scaffold hash.                                            | `pnpm --filter @recompose/desktop run test:e2e:packaged` |
| Property       | For all non-negative outer radii and insets, the concentric result equals outer minus inset floored at zero, never negative, and never exceeds the outer radius. `flattenOver` stays inside channel bounds for every color pair and alpha.                                                                                                                                                                                            | `pnpm run test`                                          |
| Mutation scope | The pure script modules join the mutate list: `scripts/**/*.mts` minus tests and minus `generate-icons.mts`, which joins the shell exclusions beside `menu-bar-tray.ts` and `main-window.ts`. The break threshold holds at 81.                                                                                                                                                                                                        | `pnpm --filter @recompose/desktop run test:mutation`     |

### Designated mutant killers

| Invariant                                    | Mutant killer                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| The floor sits exactly at inset equals outer | the boundary examples beside the property in `scripts/icon-geometry.test.mts`          |
| The Fluent ratio is exactly 2 over 48        | the example at size 48 in `scripts/icon-geometry.test.mts`                             |
| The cutoff separates 24 from 32              | both boundary examples over `usesSmallGlyph` in `scripts/icon-geometry.test.mts`       |
| The flatten alpha weights are 0.8 and 0.2    | the fills-equality spec in `scripts/brand-consistency.test.mts`, pinned to real values |
| The container layouts hold                   | the header round-trip specs in both container test files                               |

## Task decomposition hooks

Only three blockers justify serializing: a task reads what another produces, two tasks own one file, or one task inspects what another writes. Each dependency below names its blocker.

- Task 1: masters, palette, script, and gate wiring. Owns everything under `apps/desktop/scripts/`, `build/mark.svg`, `build/mark-small.svg`, `build/icon.ico`, `build/icons/`, `build/volume.icns`, the deletions of `build/icon.png` and `build/icon.icns`, everything under `apps/desktop/resources/`, `apps/desktop/package.json`, `apps/desktop/tsconfig.node.json`, both vitest configs, `apps/desktop/stryker.config.json`, `knip.json`, and `cspell-words.txt`. Depends on: none. Hands off: `brandPalette`, `flattenedMarkFills`, and the committed rasters.
- Task 2: builder keys, the rider, and the workflows. Owns `apps/desktop/electron-builder.yml`, `apps/desktop/src/main/index.ts`, `app-menu-template.ts` and its spec, `menu-bar-tray.ts`, `release.yml`, `ci.yml`, and `homebrew-bump.yml`. Depends on: none, and runs beside task 1 on disjoint files. Hands off: the four icon keys and the Recompose presentation.
- Task 3: the Icon Composer bundle, maintainer seat. Owns `build/icon.icon/`. Depends on: task 1, because the layer fills copy from `flattenedMarkFills`, which is a read of what task 1 produces. The manual verification chain stays here: the actool compile, the Icon Composer eyeball of all three appearances, and the dock-size glass-edge check.
- Task 4: the packaged smoke assertions. Owns `apps/desktop/e2e/packaged-smoke.spec.ts`. Depends on: tasks 1, 2, and 3, because it inspects the artifacts they write. Hands off: the green packaged lane.
- Task 5: the record. Owns `docs/adr/0055-app-icon-identity-and-recompose-presentation.md` and the `docs/adr/README.md` index row. Depends on: none, because this design fixes the decision set. Hands off: the accepted ADR.

Two manual steps stay with the maintainer beyond task 3. The first checks the volume icon on a mounted disk image against the legacy-grid intent. The second checks every generated raster, small glyphs included, on light and dark backdrops.

## Risks

- [Risk] `@resvg/resvg-js` renders differently on another platform, and the byte-equality spec fails away from the authoring machine → Mitigation: the version pins exactly, the masters carry no text or font, and a proven platform drift gets recorded in ADR 0055 with the spec scoped to one platform.
- [Risk] A hand edit to a committed raster ships unnoticed → Mitigation: the byte-equality spec fails until the script regenerates the file.
- [Risk] The `.icon` layer fills drift from the palette record → Mitigation: `brand-consistency.test.mts` parses the layer sources against the derived fills.
- [Risk] A plan table loses its top rung and packaging dies later with `ERR_ICON_TOO_SMALL` → Mitigation: unit specs pin 256 in the `.ico` plan and 512 in the ladder, and the script guards the floors before writing.
- [Risk] The dock-size check shows the light band fighting the glass edge → Mitigation: the locked decision names the revisit path, so task 3 pauses and the tile treatment returns to the maintainer before anything ships.
- [Risk] A local mac packaging run on a pre-Tahoe machine fails the actool gate → Mitigation: both CI mac legs pin to `macos-26`, and ADR 0055 documents the local requirement.
- [Risk] `WM_CLASS` reads Recompose after `app.setName` while `desktopName` stays lowercase, and the desktop environment drops the window association → Mitigation: the smoke asserts the `.desktop` fields, and a mismatch is a one-line `desktopName` value fix recorded on the rider ledger.
- [Risk] The AppImage `.DirIcon` assertion needs `--appimage-extract`, which may misbehave on a runner → Mitigation: the extraction needs no `FUSE` driver by design, and a flaky run quarantines the one test rather than the lane.
- [Risk] Windows and Linux icon caches keep showing the old art after an update → Mitigation: none needed, the caches refresh on their own, and no assertion reads a cache.
- [Risk] A person's settings appear reset after the user-data folder moves → Mitigation: accepted by the approved rider, the old folder stays on disk untouched, and a rollback finds it again.

## Migration and rollout

**Deploy.** One release carries the icons and the rename together. A partial swap ships the Electron logo on the platforms whose format already matched, so nothing here splits (`discovery/research.md` section 2).

**The user-data folder.** `app.setName('Recompose')` runs before the first path read, so `userData` resolves under the new name on every platform. No migration runs, per the approved rider: the folder holds a 151-byte settings document and a near-empty vault, and first launch after the upgrade starts from defaults. The old folder stays on disk untouched.

**Artifact names.** `${productName}` expands to Recompose, so filenames change case. ADR 0035's phase A ships unsigned with no updater, so no update chain breaks. The homebrew workflow discovers the disk image by suffix and survives, and its cask template moves in this change because its hardcoded app line would not.

**Rollback.** Reverting the release restores the lowercase name, and the app finds the old user-data folder with its prior contents. The Recompose folder lingers unused until a roll-forward. The e2e packaged lane isolates its own user-data directory, so tests never touch either folder (`apps/desktop/e2e/packaged-smoke.spec.ts`, `createPackagedLaunchEnv`).

## Open questions

- **Two authoring constants settle inside Icon Composer during task 3.** The mask radius the tile bands run concentric to, and the exact endpoints of the dark tile's deepened gradient. Both live inside the hand-authored bundle, both get judged by the eyeball and glass-edge checks, and neither changes the specs, the approach, or the task decomposition.

## End-to-end verification

Build all three targets, then walk the artifacts against the four feature files.

1. `mark.feature`: the Windows executable and installer show the mark, and the 16 and 24 entries of `build/icon.ico` show the cream note alone. The Linux launcher shows the mark at every ladder rung, the AppImage carries `.DirIcon`, the `.desktop` entry reads `Icon=recompose` with `StartupWMClass`, and the window frame wears the mark. No shipped icon matches the scaffold hash.
2. `liquid-glass.feature`: the macOS bundle carries `Assets.car` with `CFBundleIconName = Icon` and `icon.icns` with `CFBundleIconFile`. The Tahoe dock renders the glass icon with no fallback container, dark deepens the tile while the note holds, and tinted derives from the mono note.
3. `tray.feature`: the macOS menu bar extra shows the note silhouette tinted by the system in both schemes. Windows and Linux notification areas show the cream note with its dark contour, readable on light and dark panels.
4. `presentation.feature`: the bundle is `Recompose.app` and the About panel reads Recompose. The `.desktop` display name reads Recompose. The application menu labels the app Recompose, the tray tooltip reads Recompose, and the tray menu still offers `Open recompose` and `Quit recompose`.
5. Mounting the disk image shows the volume icon as the legacy-grid mark with the concentric bands.

A fresh-context reviewer diffs the result against these criteria:

- `apps/desktop/build/` holds no `icon.png` and no `icon.icns`, and `electron-builder.yml` names all four icon keys, so probing decides nothing.
- `brandPalette` holds exactly seven entries, and `brand-consistency.test.mts` ties `build/mark.svg`, the `.icon` layers, and every committed output to it.
- `build/icon.ico` steps through 16, 24, 32, 48, and 256, with the small glyph on the first two. `build/icons/` holds nine rungs with the same cutoff. `build/volume.icns` holds the ten pinned entry types.
- `packaged-smoke.spec.ts` carries the per-platform assertions above, titled after the scenarios they prove, and the scaffold md5 appears in no shipped asset.
- The mutate list covers the pure script modules, the shell joins the exclusions, and the gate holds at 81.
- `tray-icon.test.ts` and `window-options.test.ts` stay untouched, and the only moved spec is the application-menu label.
- `.github/workflows/release.yml` and `ci.yml` pin their mac legs to `macos-26`, and `homebrew-bump.yml` writes `app "Recompose.app"`.
- ADR 0055 sits in the index, recording the Icon Composer path with its build-machine dependency, the concentric rule, the palette record, the presentation name, the rejected `.icns`-only alternative, and the cask consequence.
