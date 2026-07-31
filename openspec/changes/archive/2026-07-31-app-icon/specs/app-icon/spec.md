# app-icon

## Purpose

The identity the packaged app presents to the operating system: the icon that the dock, the taskbar, the launcher, and the menu bar show for recompose on each platform.

## ADDED Requirements

### Requirement: The packaged app carries the recompose mark

Every packaged artifact MUST present the recompose mark as its application icon on macOS, Windows, and Linux. The stock Electron icon MUST NOT appear anywhere: not in the dock, the taskbar, the window frame, the installer, or the disk image.

#### Scenario: a person installs the app on Windows

- When a person runs the installer and pins the app
- Then the taskbar, the desktop shortcut, and the window frame show the recompose mark

#### Scenario: a person opens the disk image on macOS

- When a person opens the downloaded disk image
- Then the volume icon and the app bundle inside it show the recompose mark

#### Scenario: a person launches the app on Linux

- When a person launches the AppImage or the installed deb package
- Then the launcher entry and the window show the recompose mark

### Requirement: macOS 26 renders the icon as Liquid Glass

On macOS 26 and later, the system MUST render the icon from a native Icon Composer asset. The mark then takes part in the Liquid Glass appearance instead of sitting inside the fallback container the system wraps around legacy icons. On macOS 15 and earlier, the compatibility bitmap icon generated from the same asset MUST serve the mark without Liquid Glass.

#### Scenario: the app sits in the dock on macOS 26

- When the app runs on macOS 26
- Then the dock renders the icon from the bundled icon asset catalog
- And the mark fills its tile without a system-added container

#### Scenario: the app sits in the dock on macOS 15

- When the app runs on macOS 15
- Then the dock renders the legacy bitmap icon

### Requirement: The macOS icon carries default, dark, and mono appearances

The Icon Composer asset MUST define the default, dark, and mono appearances. The note geometry MUST stay identical across appearances. The tile varies, and in dark and mono the note carries fills derived over the dark backdrop, because the light-backdrop fills glare there. In dark, the tile MUST deepen toward the dark band palette and the light outer band MUST drop. In mono, the note MUST stand alone, and the system derives clear and tinted from it.

#### Scenario: the dock switches to dark

- When the system appearance turns dark on macOS 26
- Then the icon tile deepens while the note keeps its geometry

#### Scenario: a person picks a tinted icon style

- When a person applies a tinted icon style on macOS 26
- Then the system derives the tint from the mono appearance
- And the mono appearance shows the note alone

### Requirement: The menu bar shows the note glyph alone

The tray icon MUST show only the note glyph from the recompose mark, without the frame or the background. On macOS it MUST stay a template image the system tints. On Windows and Linux the cream note with its dark contour MUST serve, because a bare glyph has to read on light and dark panels alike.

#### Scenario: the menu bar extra on macOS

- When the app adds its menu bar extra
- Then the menu bar shows the note glyph as a template image
- And the glyph follows the menu bar appearance in light and dark

#### Scenario: the notification area on Windows

- When the app adds its notification area icon
- Then the notification area shows the cream note glyph with its dark contour
- And the glyph reads on a light taskbar and on a dark taskbar
