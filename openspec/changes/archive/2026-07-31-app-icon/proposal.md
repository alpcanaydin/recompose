# App-icon design

## Why

Every packaged artifact still wears the electron-vite scaffold artwork: the Electron logo on a dark rounded square. The discovery brief verified all four stock files, three under `apps/desktop/build/` and one under `apps/desktop/resources/` (`discovery/research.md` section 1). The README already shows the recompose mark through `docs/assets/icon.png`, so the brand exists everywhere except the product.

macOS 26 raises the stakes. The system wraps legacy bitmap icons in a fallback container, while a native Icon Composer asset takes part in Liquid Glass. Architecture Decision Record (ADR) 0008 already chose Liquid Glass window chrome, and a flat legacy icon clashes with the app's own glass surfaces (`discovery/research.md` section 6).

The tray needs the same pass. Today's tray art shows a two-node link glyph that predates the mark, not the note (`discovery/code-map.md`).

## What changes

- The three stock files under `apps/desktop/build/` leave together, because a partial swap ships the Electron logo on macOS and Windows (`discovery/research.md` section 2).
- A hand-authored Icon Composer bundle, `build/icon.icon`, becomes the macOS source. One compile yields both the macOS 26 asset catalog and the compatibility `.icns` for macOS 15 and earlier (`discovery/research.md` section 3).
- `apps/desktop/electron-builder.yml` names every icon key explicitly: `mac.icon`, `win.icon`, `linux.icon`, and `dmg.icon`. Implicit filename probing decides nothing anymore.
- `build/icon.ico` carries the Microsoft minimum ladder of 16, 24, 32, 48, and 256 (`discovery/research.md` section 4). The 16 and 24 entries show the small note glyph.
- `build/icons/` carries the Linux ladder from 16 to 512, and `desktopName` plus `linux.syncDesktopName` repair `WM_CLASS` window association (`discovery/research.md` 5.4).
- `resources/icon.png` and the three tray assets receive the new art. Nothing in `src/main/tray/` changes its logic.
- A committed script, `apps/desktop/scripts/generate-icons.mts`, renders every raster from the two master vectors.
- A rider renames the app's presentation to Recompose, because both jobs edit `apps/desktop/electron-builder.yml`.
- The release workflow pins its mac leg to macos-26, and ADR 0055 records the decision set.
- `apps/desktop/e2e/packaged-smoke.spec.ts` grows artifact-level icon assertions (`discovery/research.md` section 7).

## Locked decisions

The brainstorm settled the geometry against rendered previews, now committed at `discovery/previews/`, and `discovery/shape-conventions.md` records the original set. At the gate 1 review the maintainer replaced the small-size treatment, added the appearance and flattening decisions, and locked the amended set. Later phases don't reopen it.

- **The master stays straight-cornered and full-bleed.** Every corner rounding happens at export, per target. The concentric rule governs the frame: inner radius equals outer radius minus inset, floored at zero. A straight band under a large mask bulges at the corners, and the maintainer rejected that rendering on sight (`discovery/previews/`).
- **The sources flatten before anything renders.** The master normalizes to a 1024 canvas, loses its clip path, and every `stop-opacity` of 0.8 flattens into a solid fill. Each flattened value comes from compositing the translucent stop against its actual backdrop. Effects belong in Icon Composer only. The macOS template `.png` renders from a full-alpha silhouette, because the menu bar tint needs solid alpha.
- **macOS ships an Icon Composer asset.** The double frame stays, baked into the background layer with concentric rounding, and the system mask supplies the outer shape. One `.icon` compiled through `mac.icon` yields the asset catalog plus the compatibility `.icns`, so no hand-maintained second `.icns` exists for the bundle. Revisit only if the Icon Composer preview shows the painted frame fighting the glass edge.
- **The `.icon` bundle lands as hand-authored source.** The repository carries `icon.json` plus its vector layers. Verification runs on the maintainer's machine, which runs Tahoe with Xcode 26. It covers an actool compile, an Icon Composer eyeball, and a dock-size side-by-side check of the glass edge. That check exists because the full-bleed light band sits where the mask's specular rim renders. Apple's source rules apply: a 1024 canvas, layers as `.svg` where possible, no baked canvas mask, and background gradients configured in the composition where the format allows (`discovery/research.md` section 3).
- **The appearances vary the tile, never the note's geometry.** The note shape stays identical across every Icon Composer appearance. Its fills re-derive over the dark backdrop in dark and mono, because the maintainer's eyeball found the light-backdrop fills glaring there. Dark deepens the tile half way toward `#0C1341` and `#020309`, landing at `#192A8D` and `#0B133E` behind one depth constant, and drops the light outer band. Mono is the note alone, matching the tray discipline, and the system derives clear and tinted from mono.
- **Windows and Linux share one rendition.** The Fluent radius, 2 pixels at the 48 grid and about 4 percent, with transparent corners and concentric frame bands. At this radius the dark band's radius floors at zero, which is the rule working, not an omission.
- **Small sizes ship a purpose-drawn second master.** The arithmetic kills the self-stroke shortcut: the stem measures 9 units on the 256 grid and the beam gap 13.5. Any stroke legible at 16 pixels fills the counter into a blob. So `build/mark-small.svg` lands beside the master as the script's second input. The small and standalone glyph renders as the cream `#F2EBD1` note with a thin dark `#0C1341` contour on transparency. The contour defines the shape on light panels, and the cream carries it on dark ones. The bare blue note measured 2.2 to 1 against the Windows 11 dark taskbar, which rules it out. The Mobbin pass supports the glyph-only discipline at small sizes (`discovery/design-references.md`).
- **Every small entry drops the tile, not only the `.ico`.** The 16 and 24 pixel entries of the `.ico`, the same rungs of the Linux ladder, and the smallest `volume.icns` entries ship the small glyph. The shared rendition's frame bands collapse to 0.75 pixels at 16, which no screen resolves.
- **The tray icon is the note glyph alone everywhere.** macOS keeps the template pair the system tints, rendered as a full-alpha silhouette. The cream note with its dark contour serves as the coloured Windows and Linux variant, per the small-glyph treatment above. Art swap only.

### The rider

The app presents itself to the operating system as Recompose, title case. Same-file ownership of `electron-builder.yml` is the project's named reason to serialize, so the rename rides this change. The pieces:

- `productName: Recompose` in `apps/desktop/electron-builder.yml`.
- `app.setName('Recompose')` and `app.setAboutPanelOptions({ applicationName: 'Recompose' })` in `apps/desktop/src/main/index.ts`, placed before anything reads `app.getPath('userData')`.
- The application-menu label in `src/main/menu/app-menu-template.ts` and the tray tooltip in `src/main/tray/menu-bar-tray.ts` become Recompose. The tray menu's "Open recompose" and "Quit recompose" items read as prose and stay lowercase.
- The user-data folder moves with the name. The brainstorm assessed the move and the maintainer approved it: a 151-byte settings document, a near-empty vault, and no migration.
- The bundle id stays `sh.recompose.app`. Prose and package names stay lowercase recompose. The dev dock still reads Electron, because only the packaged bundle changes.

## What the build path dictates

- electron-builder 26.15.3 probes `icon.icns` and `icon.ico` before `icon.png` and returns a source whose extension matches the output untouched. Replacing only the `.png` would keep the Electron logo shipping on macOS and Windows, so all three stock files go together (`discovery/research.md` section 2).
- `apps/desktop/resources/icon.png` sits byte-identical to `build/icon.png` today and feeds the Linux window frame through `main-window.ts`. The pair is a named sync hazard, so the generation script owns both copies (`discovery/code-map.md`).
- Size floors bind hard: an `.icns` source needs 512 pixels, and the `.ico` and Linux set need 256, or the build fails (`discovery/research.md` section 2).
- Electron can't load a `.icon` file at runtime, so every runtime asset stays a `.png` (`discovery/research.md` 5.3).
- The coverage and mutation configs exclude `menu-bar-tray.ts` and `main-window.ts`, so no new logic lands in either file. Any testable logic goes to a pure sibling module (`discovery/code-map.md`).
- `macos-latest` already resolves to macos-26 with Xcode 26.6, which satisfies the actool 26 gate. That satisfaction arrived through label drift rather than a pin, so the release job pins the runner as cheap insurance (`discovery/research.md` section 3).
- `dmg.icon` gets an explicit value as a belt, even though the pinned source resolves the volume icon from the compatibility `.icns` on its own (`discovery/research.md` 5.2).
- The generation script is TypeScript with an `.mts` extension, registered in the `knip.json` entry list and wired into typecheck, per project convention.
- New vocabulary lands in `cspell-words.txt` in the same diff.

## Design-system gap analysis

### The mark palette stays outside the token set

The token source of truth is the two-tier pair from ADR 0009: primitives in `apps/desktop/src/renderer/src/app/styles/primitives.css` and semantics beside them in `theme.css`. The mark carries seven values: `#2640D9` and `#142273` in the background gradient, `#0C1341` and `#020309` in the dark band, `#F2EBD1` fading to white in the note, and white fading to `#AAA79C` in the outer band. None of them appears in `primitives.css` except white, which every palette shares. The interface accent is Apple's system blue, `#007aff` over `#0a84ff`, a different hue doing a different job.

The icon palette is asset-side brand geometry, not interface surface tokens. Coupling the icons to the Tailwind token set would mint semantic tokens with zero interface consumers, which fails You Aren't Gonna Need It (YAGNI). The mark does switch with the theme, through the Icon Composer appearances and the menu bar's template tint. That machinery lives in the operating system, not in CSS. The token set's `light-dark(...)` mechanism serves surfaces the renderer paints, and no icon ever renders in the DOM.

One overlap deserves a record. Brand blue `#2640D9` leads the tile gradient and identifies the product, while the interface accent stays Apple's system blue. ADR 0055 records the palette, whose authoritative home is the brand module the pipeline section names. If an interface surface ever needs brand blue, that pull request adds the semantic line, per ADR 0009's add-the-semantic-line rule.

### Where the masters live

The master vector moves from the discovery folder to `apps/desktop/build/mark.svg`, already flattened, beside every committed output the script renders from it. The purpose-drawn small master lands next to it as `build/mark-small.svg`. Both filenames are probe-safe, because the resolver's candidate list reads `icon.*` and `icons/`, never these names (`discovery/research.md` section 2). The Claude Design project recompose-design-system references those paths as the mark's source of truth.

## Asset pipeline

The maintainer left tooling to the design. The laziest deterministic pipeline consistent with the constraints follows.

### One script renders every raster

A committed script, `apps/desktop/scripts/generate-icons.mts`, renders every raster the change ships from two inputs. `build/mark.svg` supplies the tile renditions, and `build/mark-small.svg` supplies the small and standalone glyphs. Per-target geometry transforms bake the concentric rounding: the script rewrites the corner radii of the tile and both bands per rendition before rasterizing. One module, `apps/desktop/scripts/brand-palette.mts`, records the seven anchors, and `icon-geometry.mts` derives the flattened fills from them. The script imports both, and the hand-authored `.icon` layers copy their values from the derived set.

Regeneration runs on demand through a pnpm script, never at build time. Outputs land committed, matching the pattern `build/` already follows. Every packaging target then resolves a source matching its output format, so release builds skip the icons-toolset download entirely (`discovery/research.md` section 2).

### Renderer dependency

- `@resvg/resvg-js`: Mozilla Public License 2.0, which the license gate allowlists in `.claude/workflows/check-licenses/check-licenses.mts`. It ships prebuilt per-platform binaries, needs no system dependency, and pins its output to the package version, so regeneration stays deterministic on any machine.
- `sharp`: Apache-2.0, also allowlisted, but it hauls the full libvips image pipeline for a job that rasterizes one vector. Its `.svg` support also delegates to the librsvg build inside libvips.
- `rsvg-convert`: a machine dependency outside pnpm entirely, installed through brew or apt. Its output drifts with the installed librsvg version, which kills determinism.

The recommendation is `@resvg/resvg-js`. Container assembly stays small: the script writes the `.ico` container from rendered `.png` entries and writes `volume.icns` as the typed `.png` catalog the `.icns` format defines. The entry encoding at small `.ico` sizes lands in `design.md`.

### What the script owns and what stays manual

The script owns, generated and committed:

- `build/icon.ico`: 16 and 24 as the small glyph, 32 and up as the shared rendition.
- `build/icons/`: the ladder at 16, 24, 32, 48, 64, 96, 128, 256, and 512, with the small glyph on the 16 and 24 rungs.
- `build/volume.icns`: the disk-image volume icon, the shared mark at the legacy macOS grid geometry, with the small glyph in its smallest entries. Plain rounded corners approximate Apple's continuous corner here, and the approximation touches only this artifact, because actool produces the bundle's own `.icns`. Exact constants land in `design.md`.
- `resources/icon.png`: the Linux window-frame icon at 512.
- `resources/tray.png`, `resources/trayTemplate.png`, and `resources/trayTemplate@2x.png`: the note glyph, a full-alpha template silhouette for macOS and the cream contoured variant elsewhere.

Manual and hand-authored:

- `build/icon.icon`: the Icon Composer bundle, verified through actool and eyeballed in Icon Composer on the maintainer's machine.
- `build/mark.svg`: the maintainer's master vector.
- `build/mark-small.svg`: the purpose-drawn small master.

`build/icon.png` and `build/icon.icns` leave without successors, because `build/icons/` covers Linux and actool covers the bundle's compatibility `.icns`.

## Capabilities

### New capabilities

- `app-icon`: the packaged app carries the recompose mark on every platform, macOS 26 renders it as Liquid Glass from a native asset catalog, and the menu bar shows the note glyph alone.

### Modified capabilities

None.

## Impact

- Artifact filenames change case, because `${productName}` expands to Recompose. ADR 0035's phase A ships unsigned with no updater, so no update chain breaks.
- The homebrew-bump workflow survives the filename case change, because it discovers the disk image by suffix. Its cask template still hardcodes `app "recompose.app"`, which the rename breaks on the next release. The template moves to `app "Recompose.app"` and its display line to `name "Recompose"` in this change.
- The user-data folder moves with the presentation name on every platform, with no migration, per the rider assessment.
- The `.desktop` entry's display name reads Recompose while `Icon=recompose` stays, because `executableName` stays lowercase.
- The application-menu label spec moves with the label, per the invariant that test code changes if and only if behavior changes. The tray platform split keeps its behavior, so `tray-icon.test.ts` and `window-options.test.ts` stay untouched.
- `apps/desktop/e2e/packaged-smoke.spec.ts` gains filesystem and property-list assertions from the discovery acceptance list: the asset catalog and both icon keys on macOS, the `.ico` ladder on Windows, the hicolor set and `.DirIcon` on Linux, and no scaffold bytes anywhere (`discovery/research.md` section 7).
- The release workflow's mac leg pins to macos-26.
- ADR 0055 lands through the architecture-decision-records skill and records the decision set: the Icon Composer path and its build-machine dependency, the concentric rule, the brand palette, the Recompose presentation name, and the rejected `.icns`-only alternative.
- `knip.json` and the typecheck wiring gain the generation script, and `cspell-words.txt` gains the icon vocabulary in the same diff.
- `docs/assets/icon.png` already matches the mark and stays untouched. No renderer file changes, and no Feature-Sliced Design layer takes part (`discovery/code-map.md`).
