# Shape conventions: the session's platform research

Research the session ran during the brainstorm, with the maintainer reacting to rendered previews at each step. The previews live outside the repository; the geometry they validated is recorded here.

## Per-platform findings

### macOS 26 and the mask

The system applies the squircle mask and the Liquid Glass edge itself. Layers ship unmasked and square; anything painted near the edge gets cropped by the mask. electron-builder 26.1.0 added Icon Composer support: `mac.icon` set to a `.icon` asset compiles to an asset catalog through `actool`, which needs Xcode 26 on a macOS 15+ build machine. The DMG volume icon still reads `.icns`, so `dmg.icon` needs an explicit path once `mac.icon` points at the `.icon` asset. Sources: [electron-builder icons docs](https://www.electron.build/icons.html), [electron-builder issue 9254](https://github.com/electron-userland/electron-builder/issues/9254).

### Windows

No system mask and no container mandate. Microsoft's guidance asks for a free-form silhouette on the 48 pixel grid with soft corners: a 2 pixel radius on exterior curves at 48 by 48, about 4 percent, and a transparent background where possible. Plated backgrounds stay acceptable. Small target sizes (16, 24) serve the taskbar and title bar without padding. Source: [Microsoft app icon design guidelines](https://learn.microsoft.com/en-us/windows/apps/design/iconography/app-icon-design).

### Linux

No mandated shape anywhere in the stack. The [freedesktop icon theme spec](https://specifications.freedesktop.org/icon-theme/latest/) governs delivery only: square canvas, hicolor theme, PNG sizes plus an optional scalable SVG. [GNOME's HIG](https://developer.gnome.org/hig/guidelines/app-icons.html) wants simple geometric free-form marks; [KDE](https://develop.kde.org/hig/icons/) wants a distinct silhouette; [Flathub's quality guidelines](https://docs.flathub.org/docs/for-app-authors/metainfo-guidelines/quality-guidelines) explicitly accept a square or circular container from their icon grid.

## The concentric rule

A frame band inside a rounded outer edge takes the radius of the outer edge minus the band's inset, floored at zero. A straight-cornered band under a large mask bulges at the corners; the maintainer rejected that rendering on sight. With the concentric rule applied, band thickness stays optically constant around the corner. At the Fluent radius the dark band's concentric radius bottoms out at zero, which is the rule working, not an omission.

## Decisions the maintainer locked during the brainstorm

1. The master SVG stays straight-cornered and full-bleed; every rounding decision happens at export, per target.
2. macOS: the frame stays in the Tahoe icon, baked into the background layer with concentric rounding; the system mask supplies the outer shape. Revisit only if the Icon Composer preview shows the painted frame fighting the glass edge.
3. Windows and Linux share one rendition: the Fluent radius, about 4 percent, corners transparent, frame bands concentric.
4. The 16 and 24 pixel ico variants drop the tile entirely: a thickened note glyph alone on transparency, in the brand blue #2640D9, because white vanishes on a light taskbar.
5. The tray icon is the note glyph alone everywhere: template image on macOS (existing behavior), the blue note on transparency for the coloured Windows and Linux variant.
