import { readFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { brandPalette } from './brand-palette.mts';
import { iconOutputs } from './generate-icons.mts';
import {
  concentricRadius,
  darkBandInsetFraction,
  flattenedMarkFills,
  markCanvas,
  tileInsetFraction,
} from './icon-geometry.mts';

function readMaster(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../build/${name}`, import.meta.url)), 'utf8');
}

function colorsPaintedIn(master: string): readonly string[] {
  return [...new Set(master.match(/#[0-9A-Fa-f]{6}/g) ?? [])]
    .map((color) => color.toUpperCase())
    .toSorted();
}

function sortedUpperCase(colors: readonly string[]): readonly string[] {
  return colors.map((color) => color.toUpperCase()).toSorted();
}

const ICON_BUNDLE_LAYERS = [
  'Assets/note.svg',
  'Assets/note-dark.svg',
  'Assets/tile.svg',
  'Assets/tile-dark.svg',
];
const SRGB_COMPONENT_PATTERN = /srgb:([\d.]+),([\d.]+),([\d.]+),[\d.]+/g;
const CHANNEL_MAX = 255;
const CORNER_RADIUS_PATTERN = /rx="([\d.]+)"/g;
const MEASURED_MASK_RADIUS = 231.165;
const TILE_LAYERS = ['Assets/tile.svg', 'Assets/tile-dark.svg'];

function readIconBundle(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../build/icon.icon/${name}`, import.meta.url)),
    'utf8',
  );
}

function hexFromChannel(component: string): string {
  return Math.round(Number(component) * CHANNEL_MAX)
    .toString(16)
    .padStart(2, '0');
}

function colorsDeclaredIn(source: string): readonly string[] {
  const componentColors = [...source.matchAll(SRGB_COMPONENT_PATTERN)].map(
    ([, red = '0', green = '0', blue = '0']) =>
      `#${hexFromChannel(red)}${hexFromChannel(green)}${hexFromChannel(blue)}`,
  );

  return [
    ...new Set(sortedUpperCase([...(source.match(/#[0-9A-Fa-f]{6}/g) ?? []), ...componentColors])),
  ].toSorted();
}

function cornerRadiiIn(layer: string): readonly number[] {
  return [...readIconBundle(layer).matchAll(CORNER_RADIUS_PATTERN)].map((match) =>
    Number(match[1]),
  );
}

const traceableFills = new Set(
  sortedUpperCase([...Object.values(brandPalette), ...Object.values(flattenedMarkFills)]),
);

function untraceableFillsIn(name: string): readonly { file: string; color: string }[] {
  return colorsDeclaredIn(readIconBundle(name))
    .filter((color) => !traceableFills.has(color))
    .map((color) => ({ file: name, color }));
}

describe('the Icon Composer bundle', () => {
  it('traces every fill it declares back to the palette record', () => {
    expect(['icon.json', ...ICON_BUNDLE_LAYERS].flatMap(untraceableFillsIn)).toEqual([]);
  });

  it('fills the manifest backdrop with the frame bottom anchor', () => {
    expect(colorsDeclaredIn(readIconBundle('icon.json'))).toEqual(
      sortedUpperCase([brandPalette.frameBottom]),
    );
  });

  it('paints the note layer from the composited note stops alone', () => {
    expect(colorsDeclaredIn(readIconBundle('Assets/note.svg'))).toEqual(
      sortedUpperCase([flattenedMarkFills.noteTop, flattenedMarkFills.noteBottom]),
    );
  });

  it('paints the dark note layer from the composited dark note stops alone', () => {
    expect(colorsDeclaredIn(readIconBundle('Assets/note-dark.svg'))).toEqual(
      sortedUpperCase([flattenedMarkFills.darkNoteTop, flattenedMarkFills.darkNoteBottom]),
    );
  });

  it('draws the same note geometry in both appearances, differing only in fill', () => {
    const fillReference = /url\(#[a-zA-Z]+\)/g;
    const geometryOf = (layer: string): string =>
      readIconBundle(layer)
        .replace(/<defs>[\s\S]*<\/defs>/, '')
        .replaceAll(fillReference, 'url(#gradient)');

    expect(geometryOf('Assets/note-dark.svg')).toBe(geometryOf('Assets/note.svg'));
  });

  it('paints the light tile layer from the tile anchors and the composited bands', () => {
    expect(colorsDeclaredIn(readIconBundle('Assets/tile.svg'))).toEqual(
      sortedUpperCase([
        brandPalette.tileTop,
        brandPalette.tileBottom,
        flattenedMarkFills.darkBandTop,
        flattenedMarkFills.darkBandBottom,
        flattenedMarkFills.outerBandTop,
        flattenedMarkFills.outerBandBottom,
      ]),
    );
  });

  it('paints the dark tile layer from the deepened tile stops and the composited dark band', () => {
    expect(colorsDeclaredIn(readIconBundle('Assets/tile-dark.svg'))).toEqual(
      sortedUpperCase([
        flattenedMarkFills.darkTileTop,
        flattenedMarkFills.darkTileBottom,
        flattenedMarkFills.darkBandTop,
        flattenedMarkFills.darkBandBottom,
      ]),
    );
  });
});

describe('the Icon Composer tile geometry', () => {
  it('rounds both band corners concentric to the measured mask radius, in both tiles', () => {
    const concentricToTheMask = [
      concentricRadius(MEASURED_MASK_RADIUS, markCanvas * darkBandInsetFraction),
      concentricRadius(MEASURED_MASK_RADIUS, markCanvas * tileInsetFraction),
    ];

    expect(TILE_LAYERS.map(cornerRadiiIn)).toEqual([concentricToTheMask, concentricToTheMask]);
  });
});

describe('the brand palette', () => {
  it('records exactly the seven source anchors the mark is built from', () => {
    expect(brandPalette).toEqual({
      tileTop: '#2640D9',
      tileBottom: '#142273',
      frameTop: '#0C1341',
      frameBottom: '#020309',
      noteCream: '#F2EBD1',
      brandWhite: '#FFFFFF',
      bandFade: '#AAA79C',
    });
  });
});

describe('the flattened mark fills', () => {
  it('composites the dark band over the tile gradient ends', () => {
    expect(flattenedMarkFills.darkBandTop).toBe('#111C5F');
    expect(flattenedMarkFills.darkBandBottom).toBe('#06091E');
  });

  it('composites the outer band over the flattened dark band beneath it', () => {
    expect(flattenedMarkFills.outerBandTop).toBe('#CFD2DF');
    expect(flattenedMarkFills.outerBandBottom).toBe('#898783');
  });

  it('composites the note over the tile sampled across the note gradient span', () => {
    expect(flattenedMarkFills.noteTop).toBe('#C9C8CF');
    expect(flattenedMarkFills.noteBottom).toBe('#D1D4E7');
  });

  it('carries the tile stops halfway toward the frame anchors, so the dark tile stays blue', () => {
    expect(flattenedMarkFills.darkTileTop).toBe('#192A8D');
    expect(flattenedMarkFills.darkTileBottom).toBe('#0B133E');
  });

  it('composites the note over the deepened tile for the dark appearance', () => {
    expect(flattenedMarkFills.darkNoteTop).toBe('#C6C4C1');
    expect(flattenedMarkFills.darkNoteBottom).toBe('#CFD1DB');
  });

  it('derives exactly the ten solids the mark paints beyond its anchors', () => {
    expect(Object.keys(flattenedMarkFills).toSorted()).toEqual([
      'darkBandBottom',
      'darkBandTop',
      'darkNoteBottom',
      'darkNoteTop',
      'darkTileBottom',
      'darkTileTop',
      'noteBottom',
      'noteTop',
      'outerBandBottom',
      'outerBandTop',
    ]);
  });
});

describe('the flattened 1024 master', () => {
  const master = readMaster('mark.svg');

  it('paints only the tile anchors and the fills derived from the palette', () => {
    expect(colorsPaintedIn(master)).toEqual(
      sortedUpperCase([
        brandPalette.tileTop,
        brandPalette.tileBottom,
        flattenedMarkFills.darkBandTop,
        flattenedMarkFills.darkBandBottom,
        flattenedMarkFills.outerBandTop,
        flattenedMarkFills.outerBandBottom,
        flattenedMarkFills.noteTop,
        flattenedMarkFills.noteBottom,
      ]),
    );
  });

  it('leaves no translucent stop behind, because every stop is already composited', () => {
    expect(master).not.toContain('stop-opacity');
    expect(master).not.toContain('fill-opacity');
  });

  it('drops the clip path the unflattened source carried', () => {
    expect(master).not.toContain('clipPath');
    expect(master).not.toContain('clip-path');
  });

  it('draws on the 1024 canvas every rendition scales from', () => {
    expect(master).toContain('viewBox="0 0 1024 1024"');
  });

  it('nests the two bands at the master inset fractions of the edge', () => {
    expect(master).toContain('x="48" y="48" width="928" height="928"');
    expect(master).toContain('x="96" y="96" width="832" height="832"');
  });
});

describe('the purpose drawn small master', () => {
  const smallMaster = readMaster('mark-small.svg');

  it('paints the cream note inside the dark contour and nothing else', () => {
    expect(colorsPaintedIn(smallMaster)).toEqual(
      sortedUpperCase([brandPalette.noteCream, brandPalette.frameTop]),
    );
  });

  it('holds the contour at the weight that still renders at 16 pixels', () => {
    expect(smallMaster).toContain('stroke-width="64"');
  });

  it('leaves transparency behind the glyph, so no tile competes at small sizes', () => {
    expect(smallMaster).not.toContain('<rect');
  });

  it('draws on the same 1024 canvas as the full mark', () => {
    expect(smallMaster).toContain('viewBox="0 0 1024 1024"');
  });
});

describe('the committed rasters and containers', () => {
  it('covers exactly the icon files the packaging targets resolve', () => {
    expect(
      iconOutputs()
        .map(([path]) => `${basename(dirname(path))}/${basename(path)}`)
        .toSorted(),
    ).toEqual([
      'build/icon.ico',
      'build/volume.icns',
      'icons/128x128.png',
      'icons/16x16.png',
      'icons/24x24.png',
      'icons/256x256.png',
      'icons/32x32.png',
      'icons/48x48.png',
      'icons/512x512.png',
      'icons/64x64.png',
      'icons/96x96.png',
      'resources/icon.png',
      'resources/tray.png',
      'resources/trayTemplate.png',
      'resources/trayTemplate@2x.png',
    ]);
  });

  it('matches a regeneration from the masters byte for byte, so no hand edit survives', () => {
    for (const [path, bytes] of iconOutputs()) {
      expect({ path, bytes: Buffer.from(readFileSync(path)) }).toEqual({
        path,
        bytes: Buffer.from(bytes),
      });
    }
  });
});
