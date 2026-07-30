import { describe, expect, it } from 'vitest';

import { brandPalette } from './brand-palette.mts';
import { flattenedMarkFills } from './icon-geometry.mts';

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

  it('derives exactly the six composited stops', () => {
    expect(Object.keys(flattenedMarkFills).toSorted()).toEqual([
      'darkBandBottom',
      'darkBandTop',
      'noteBottom',
      'noteTop',
      'outerBandBottom',
      'outerBandTop',
    ]);
  });
});
