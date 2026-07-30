# 0055: The app icon identity and the Recompose presentation

**Status**: Accepted
**Date**: 2026-07-30

## Context

Every packaged artifact still wore the electron-vite scaffold artwork: the Electron logo on a dark rounded square. Four stock files carried it, three under `apps/desktop/build/` and one under `apps/desktop/resources/`. `apps/desktop/electron-builder.yml` named no icon key at all, so electron-builder resolved every icon by probing filenames. That probe order returns a source whose extension matches the output untouched, so replacing only the `.png` would keep the Electron logo shipping on macOS and Windows.

macOS 26 raises the cost of doing nothing. The system wraps a legacy bitmap icon in a fallback container, while a native Icon Composer asset takes part in Liquid Glass. Architecture Decision Record (ADR) 0008 already chose Liquid Glass window chrome, so a flat legacy icon fights the app's own glass surfaces.

The app also presented itself to the operating system as `recompose`, lowercase, which reads as a package name rather than a product name. That rename touches `electron-builder.yml`, the same file the icon keys land in.

## Decision

- **macOS ships a hand-authored Icon Composer bundle.** `build/icon.icon` lands as source, `mac.icon` points at it, and one actool compile yields both the Tahoe asset catalog and the compatibility `.icns` for macOS 15 and earlier. The repository carries no hand-maintained second `.icns`. The bundle defines default, dark, and mono appearances, and the note geometry stays identical across all three. The layers ride three groups rather than two, because actool 26.6 ignores appearance rules set on a layer and honors them only on a group. The cost is a build-machine dependency. Every mac packaging step invokes actool, so both workflow mac legs pin to `macos-26` rather than trusting `macos-latest` label drift, and a local mac package needs Tahoe with Xcode 26.
- **The concentric rule is the single radius law.** Inner radius equals outer radius minus inset, floored at zero. One pure function serves three call sites. The macOS tile runs against the system mask radius, the shared Windows and Linux rendition against the Fluent radius, and the volume icon against the legacy grid. Where an inset exceeds the outer radius the inner radius floors at zero, which is the rule working rather than an omission.
- **One palette record holds seven anchors, and everything else derives.** `scripts/brand-palette.mts` records the seven brand solids. A pure flatten function composites each 0.8-opacity stop against its actual backdrop, and a spec asserts that the master vector and the bundle layers match the derived set. The palette stays outside the two-tier token set from ADR 0009, because it has no interface consumer and the theme switching lives in the operating system.
- **The app presents itself as Recompose, and the cask moves with it.** `productName`, `app.setName`, the About panel, the application-menu label, and the tray tooltip all move to title case. Same-file ownership of `electron-builder.yml` is the project's named reason to serialize, so the rename rides this change. The cask template in `homebrew-bump.yml` moves its app and name lines in the same change, because the rename breaks them on the next release. The bundle identifier stays `sh.recompose.app`, and prose and package names stay lowercase.
- **Explicit icon keys replace filename probing.** `mac.icon`, `win.icon`, `linux.icon`, and `dmg.icon` all land, even where probing would resolve the right file. Probing is what let the stock `.icns` and `.ico` outrank a replaced `.png` without a warning.
- **Rasters land committed, and regeneration is an on-demand script.** `scripts/generate-icons.mts` renders every raster from two master vectors, and a byte-equality spec fails until the script regenerates a hand-edited output. Build time stays free of rendering, network fetches, and system tools.
- **The `.ico` encodes small entries as bitmaps and the 256 entry as `.png`.** Entries below 256 land as 32-bit `BGRA` device-independent bitmaps with an `AND` mask. Old shell surfaces predate `.png` entries at small sizes, while 256 as `.png` is the composition Windows already scales down from. The encoder is pure, so a header round-trip spec pins the layout.
- **The feature files stay the review contract.** The four scenario files remain the approval artifact. Scenarios a machine can judge land as assertions in `packaged-smoke.spec.ts`, titled after the scenarios they prove. The glass edge and the tray tint go to the maintainer's manual pass, because no process observes them.

## Alternatives

- **A hand-maintained `.icns` alone**: rejected. It forfeits Liquid Glass, dark, tinted, and clear on macOS 26, and it leaves the icon behind the shell ADR 0008 chose. Its only advantage is the absence of a build-machine dependency, which the runner pins already contain.
- **Generating the Icon Composer bundle from the script**: rejected. The format's appearance semantics come from human judgment, and the verification chain runs by hand anyway.
- **Straight frame bands under the target masks**: rejected on sight against rendered previews, where a straight band bulges at the corners.
- **Per-target hand-tuned radii**: rejected. Three unexplained constants drift where one rule can't.
- **Recording the composited fills as literals**: rejected. Nobody can verify eight literals with hidden arithmetic, while seven anchors plus a pure function invite a spec.
- **Minting semantic tokens for the brand palette**: rejected as tokens with zero interface consumers. ADR 0009's add-the-semantic-line rule covers any future interface use.
- **A separate rename change**: rejected. Two changes would own `electron-builder.yml`, which is the project's own serialization trigger.
- **Keeping the old user-data path through `setPath`**: rejected. It preserves a dead name forever to save a 151-byte document.
- **Keeping the filename convention**: rejected. The probe order is the trap this change exists to close.
- **Rendering icons at package time**: rejected. It adds an icon-toolset download and a tool whose output drifts to three release runners.
- **A checked-in third-party icon pipeline**: rejected. Two vector inputs and two containers don't justify a dependency tree.
- **`.png` payloads at every `.ico` size**: rejected. It trades a few kilobytes for a compatibility question this design doesn't need to ask.
- **Copying the feature files into `e2e/features/` with step definitions**: rejected. The packaged lane runs plain Playwright, and half the steps would assert nothing a process can observe.

## Consequences

**Good**: every packaged artifact wears the mark, and no shipped file matches the scaffold artwork. macOS 26 renders the icon as Liquid Glass from a native asset catalog, and one compile also covers macOS 15. A named key fails with a clear error when its file goes missing, where probing failed without a word. The palette has one authoritative home, and a hand-edited raster fails the suite until the script regenerates it.

**Bad, and accepted**: a mac package now needs Xcode 26, which pins both workflow mac legs and rules out packaging on a pre-Tahoe machine. The user-data folder moves with the presentation name, with no migration, so a person's settings appear reset after the upgrade. The maintainer approved that trade: the folder holds a 151-byte settings document and a near-empty vault, and the old folder stays on disk for a rollback to find. The Homebrew cask template names `recompose.app` outright, so it breaks on the next release unless `homebrew-bump.yml` moves with the rename. Artifact filenames change case, which ADR 0035's phase A absorbs, because it ships unsigned with no updater. Two authoring constants stay open until the bundle exists: the mask radius the bands run concentric to, and the endpoints of the dark tile's deepened gradient.
