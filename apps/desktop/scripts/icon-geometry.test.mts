import { fc, test as propertyTest } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import { brandPalette } from './brand-palette.mts';
import {
  concentricRadius,
  darkBandInsetFraction,
  flattenOver,
  fluentOuterRadius,
  icoPlan,
  linuxLadder,
  markCanvas,
  sharedRendition,
  silhouetteOf,
  tileInsetFraction,
  tileSampleAt,
  usesSmallGlyph,
  volumeRendition,
} from './icon-geometry.mts';

const hexColor = fc
  .tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
  )
  .map(
    (channels) =>
      `#${channels.map((channel) => channel.toString(16).padStart(2, '0').toUpperCase()).join('')}`,
  );

const iconLength = fc.double({ min: 0, max: 4096, noNaN: true });
const radiusAndInset: [fc.Arbitrary<number>, fc.Arbitrary<number>] = [iconLength, iconLength];

function channelsOf(color: string): readonly number[] {
  return [color.slice(1, 3), color.slice(3, 5), color.slice(5, 7)].map((pair) =>
    Number.parseInt(pair, 16),
  );
}

describe('flattening a translucent stop over its backdrop', () => {
  it('returns the foreground when the stop is fully opaque', () => {
    expect(flattenOver('#2640D9', '#F2EBD1', 1)).toBe('#2640D9');
  });

  it('returns the backdrop when the stop is fully transparent', () => {
    expect(flattenOver('#2640D9', '#F2EBD1', 0)).toBe('#F2EBD1');
  });

  it('weights the stop at the mark opacity of four fifths', () => {
    expect(flattenOver('#0C1341', '#2640D9', 0.8)).toBe('#111C5F');
  });

  it('rejects a color that is not a six digit hex triplet', () => {
    expect(() => flattenOver('rgb(0,0,0)', '#FFFFFF', 0.8)).toThrow('rgb(0,0,0)');
  });

  propertyTest.prop([hexColor, hexColor, fc.double({ min: 0, max: 1, noNaN: true })])(
    'keeps every channel inside the eight bit range',
    (foreground, backdrop, alpha) => {
      for (const channel of channelsOf(flattenOver(foreground, backdrop, alpha))) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(255);
      }
    },
  );

  propertyTest.prop([hexColor, hexColor, fc.double({ min: 0, max: 1, noNaN: true })])(
    'never lands outside the span between the two colors on any channel',
    (foreground, backdrop, alpha) => {
      const blended = channelsOf(flattenOver(foreground, backdrop, alpha));
      const front = channelsOf(foreground);
      const back = channelsOf(backdrop);

      blended.forEach((channel, index) => {
        const low = Math.min(front[index] ?? 0, back[index] ?? 0);
        const high = Math.max(front[index] ?? 0, back[index] ?? 0);

        expect(channel).toBeGreaterThanOrEqual(low);
        expect(channel).toBeLessThanOrEqual(high);
      });
    },
  );
});

describe('sampling the tile gradient', () => {
  it('reads the tile top at the start of the span', () => {
    expect(tileSampleAt(0)).toBe(brandPalette.tileTop);
  });

  it('reads the tile bottom at the end of the span', () => {
    expect(tileSampleAt(1)).toBe(brandPalette.tileBottom);
  });

  it('interpolates toward the tile bottom across the span', () => {
    expect(tileSampleAt(46 / 256)).toBe('#233BC7');
    expect(tileSampleAt(210 / 256)).toBe('#172785');
  });
});

describe('the concentric radius rule', () => {
  it('shrinks the inner radius by the inset the band sits at', () => {
    expect(concentricRadius(42, 12)).toBe(30);
  });

  it('floors at zero exactly where the inset reaches the outer radius', () => {
    expect(concentricRadius(12, 11)).toBe(1);
    expect(concentricRadius(12, 12)).toBe(0);
    expect(concentricRadius(12, 13)).toBe(0);
  });

  propertyTest.prop(radiusAndInset)(
    'never turns negative and never outgrows the radius it nests inside',
    (outer, inset) => {
      const inner = concentricRadius(outer, inset);

      expect(inner).toBeGreaterThanOrEqual(0);
      expect(inner).toBeLessThanOrEqual(outer);
    },
  );

  propertyTest.prop(radiusAndInset)(
    'subtracts the whole inset while the band still fits inside the corner',
    (outer, inset) => {
      fc.pre(inset <= outer);

      expect(concentricRadius(outer, inset)).toBeCloseTo(outer - inset, 10);
    },
  );
});

describe('the Fluent outer radius', () => {
  it('yields two units on the 48 unit grid', () => {
    expect(fluentOuterRadius(48)).toBe(2);
  });

  it('scales with the rendition size', () => {
    expect(fluentOuterRadius(24)).toBe(1);
    expect(fluentOuterRadius(96)).toBe(4);
  });

  it('leaves both band corners square on every shared rendition rung', () => {
    for (const size of linuxLadder) {
      expect(concentricRadius(fluentOuterRadius(size), size * darkBandInsetFraction)).toBe(0);
      expect(concentricRadius(fluentOuterRadius(size), size * tileInsetFraction)).toBe(0);
    }
  });
});

describe('the rendition plans', () => {
  it('steps the Windows container through the Microsoft minimum ladder', () => {
    expect(icoPlan).toEqual([16, 24, 32, 48, 256]);
  });

  it('tops the Windows container at 256 so packaging clears its floor', () => {
    expect(icoPlan.at(-1)).toBe(256);
  });

  it('steps the Linux ladder through its nine rungs', () => {
    expect(linuxLadder).toEqual([16, 24, 32, 48, 64, 96, 128, 256, 512]);
  });

  it('tops the Linux ladder at 512 so packaging clears its floor', () => {
    expect(linuxLadder.at(-1)).toBe(512);
  });
});

describe('the small glyph cutoff', () => {
  it('draws the purpose drawn note below 32 points', () => {
    expect(usesSmallGlyph(16)).toBe(true);
    expect(usesSmallGlyph(24)).toBe(true);
  });

  it('draws the tile rendition from 32 points up', () => {
    expect(usesSmallGlyph(32)).toBe(false);
    expect(usesSmallGlyph(48)).toBe(false);
  });
});

const straightMaster = [
  '<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">',
  '<rect width="1024" height="1024" fill="url(#outerBand)"/>',
  '<rect x="48" y="48" width="928" height="928" fill="url(#darkBand)"/>',
  '<rect x="96" y="96" width="832" height="832" fill="url(#tile)"/>',
  '</svg>',
].join('\n');

describe('the shared Windows and Linux rendition', () => {
  const rendition = sharedRendition(straightMaster);

  it('rounds the outer edge to the Fluent radius on the master canvas', () => {
    const [, outer] = /rect width="1024" height="1024" rx="([\d.]+)"/.exec(rendition) ?? [];

    expect(Number(outer)).toBeCloseTo(fluentOuterRadius(markCanvas), 3);
  });

  it('leaves both bands square, because the Fluent radius never reaches their insets', () => {
    expect(rendition).toContain('<rect x="48" y="48" width="928" height="928" rx="0"');
    expect(rendition).toContain('<rect x="96" y="96" width="832" height="832" rx="0"');
  });

  it('refuses a master whose frame rectangles it cannot find', () => {
    expect(() => sharedRendition('<svg></svg>')).toThrow('frame');
  });
});

describe('the volume rendition', () => {
  const rendition = volumeRendition(straightMaster);

  it('insets the mark by the transparent margin the legacy grid leaves', () => {
    expect(rendition).toContain('translate(100 100) scale(0.8046875)');
  });

  it('rounds the outer corner so it lands at the pinned legacy radius', () => {
    const masterRadius = Number(
      /rect width="1024" height="1024" rx="([\d.]+)"/.exec(rendition)?.[1],
    );

    expect(masterRadius * 0.8046875).toBeCloseTo(186, 4);
  });

  it('runs both bands concentric to that corner', () => {
    const [, darkBand] = /width="928" height="928" rx="([\d.]+)"/.exec(rendition) ?? [];
    const [, tile] = /width="832" height="832" rx="([\d.]+)"/.exec(rendition) ?? [];

    expect(Number(darkBand) * 0.8046875).toBeCloseTo(147.375, 3);
    expect(Number(tile) * 0.8046875).toBeCloseTo(108.75, 3);
  });

  it('keeps the whole thing on the 1024 canvas the container renders from', () => {
    expect(rendition.startsWith('<svg width="1024" height="1024" viewBox="0 0 1024 1024"')).toBe(
      true,
    );
  });
});

describe('the tray template silhouette', () => {
  const smallMaster =
    '<path d="M0 0" fill="#F2EBD1" stroke="#0C1341" stroke-width="64" stroke-linejoin="round"/>';

  it('flattens the cream note and its contour into one opaque black shape', () => {
    const silhouette = silhouetteOf(smallMaster);

    expect(silhouette).toContain('fill="#000000"');
    expect(silhouette).toContain('stroke="#000000"');
    expect(silhouette).not.toContain('#F2EBD1');
    expect(silhouette).not.toContain('#0C1341');
  });
});
