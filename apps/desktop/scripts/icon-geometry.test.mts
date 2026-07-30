import { fc, test as propertyTest } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import { brandPalette } from './brand-palette.mts';
import { flattenOver, tileSampleAt } from './icon-geometry.mts';

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
