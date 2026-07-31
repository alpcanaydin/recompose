import { expect, test } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  appDir,
  buildDir,
  bundlePlistValue,
  debDesktopEntry,
  entryAtSize,
  extractedAppImage,
  extractedDeb,
  fullyTransparentSamples,
  fullyTransparentSamplesInPng,
  hicolorRung,
  ICO_PNG_ENTRY_SIZE,
  iconFilesUnder,
  icoEntries,
  latestBuildDir,
  packagedBundle,
  packagedExecutable,
  scaffoldIconsUnder,
} from './packaged-artifact';

const ICO_LADDER = [16, 24, 32, 48, 256];
const SMALL_GLYPH_SIZES = [16, 24];
const TILED_SIZES = [32, 48];
const HICOLOR_LADDER = [16, 24, 32, 48, 64, 96, 128, 256, 512];
const markIco = () => icoEntries(join(buildDir, 'icon.ico'));

function expectRuntimeIconIsTheCommittedMark(root: string): void {
  const shipped = iconFilesUnder(root).filter((file) =>
    file.endsWith(join('resources', 'icon.png')),
  );
  const committed = readFileSync(join(appDir, 'resources', 'icon.png'));

  expect(shipped.length).toBeGreaterThan(0);
  expect(shipped.map((file) => readFileSync(file))).toEqual(shipped.map(() => committed));
}

test.describe('the packaged macOS bundle', () => {
  test.skip(process.platform !== 'darwin', 'only a darwin run packages an app bundle');

  test('the bundle names itself Recompose', () => {
    expect(bundlePlistValue(packagedBundle(), 'CFBundleName')).toBe('Recompose');
  });

  test('the bundle carries a native icon asset catalog and names it as its icon', () => {
    const bundle = packagedBundle();

    expect(existsSync(join(bundle, 'Contents', 'Resources', 'Assets.car'))).toBe(true);
    expect(bundlePlistValue(bundle, 'CFBundleIconName')).toBe('Icon');
  });

  test('the bundle carries a legacy bitmap icon and names it as its fallback', () => {
    const bundle = packagedBundle();

    expect(bundlePlistValue(bundle, 'CFBundleIconFile')).toBe('icon.icns');
    expect(existsSync(join(bundle, 'Contents', 'Resources', 'icon.icns'))).toBe(true);
  });

  test('the window icon the app loads at runtime is the recompose mark', () => {
    expectRuntimeIconIsTheCommittedMark(packagedBundle());
  });

  test('no icon the artifact ships matches the stock Electron artwork', () => {
    expect(scaffoldIconsUnder(packagedBundle())).toEqual([]);
  });
});

test.describe('the committed Windows icon container', () => {
  test('the icon steps through 16, 24, 32, 48, and 256 pixels', () => {
    expect(markIco().map((entry) => entry.size)).toEqual(ICO_LADDER);
  });

  test('the 16 and 24 pixel entries drop the tile and show the note alone', () => {
    const transparencyAt = (sizes: readonly number[]) =>
      sizes.map((size) => fullyTransparentSamples(entryAtSize(markIco(), size)) > 0);

    expect(transparencyAt(SMALL_GLYPH_SIZES)).toEqual([true, true]);
    expect(transparencyAt(TILED_SIZES)).toEqual([false, false]);
  });
});

test.describe('the packaged Windows build', () => {
  test.skip(process.platform !== 'win32', 'only a win32 run packages the executable');

  test('the executable carries the recompose mark as its icon', () => {
    const embedded = entryAtSize(markIco(), ICO_PNG_ENTRY_SIZE).payload;

    expect(readFileSync(packagedExecutable()).includes(embedded)).toBe(true);
  });

  test('no icon the artifact ships matches the stock Electron artwork', () => {
    expect(scaffoldIconsUnder(latestBuildDir())).toEqual([]);
  });
});

test.describe('the packaged Linux build', () => {
  test.skip(process.platform !== 'linux', 'only a linux run packages the deb and the AppImage');

  test('the installed icon theme carries the mark at every ladder rung', () => {
    const installed = HICOLOR_LADDER.map((size) => readFileSync(hicolorRung(size)));
    const committed = HICOLOR_LADDER.map((size) =>
      readFileSync(join(buildDir, 'icons', `${String(size)}x${String(size)}.png`)),
    );

    expect(installed).toEqual(committed);
  });

  test('the 16 and 24 pixel rungs drop the tile and show the note alone', () => {
    const transparencyAt = (sizes: readonly number[]) =>
      sizes.map((size) => fullyTransparentSamplesInPng(hicolorRung(size)) > 0);

    expect(transparencyAt(SMALL_GLYPH_SIZES)).toEqual([true, true]);
    expect(transparencyAt(TILED_SIZES)).toEqual([false, false]);
  });

  test('the window icon the app loads at runtime is the recompose mark', () => {
    expectRuntimeIconIsTheCommittedMark(extractedDeb());
  });

  test('the image carries the recompose mark as its directory icon', () => {
    expect(existsSync(join(extractedAppImage(), '.DirIcon'))).toBe(true);
  });

  test('the desktop entry names the icon recompose and links running windows to it', () => {
    expect(debDesktopEntry().get('Icon')).toBe('recompose');
    expect(debDesktopEntry().get('StartupWMClass')).toBe('recompose');
  });

  test('the desktop entry displays Recompose', () => {
    expect(debDesktopEntry().get('Name')).toBe('Recompose');
  });

  test('no icon the artifact ships matches the stock Electron artwork', () => {
    expect(scaffoldIconsUnder(latestBuildDir())).toEqual([]);
    expect(scaffoldIconsUnder(extractedDeb())).toEqual([]);
  });
});
