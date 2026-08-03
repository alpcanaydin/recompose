import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { paintedBox, paintedStyle } from '../../../../shared/testing';
import { GhostGraph } from './ghost-graph';

const meta = preview.meta({
  component: GhostGraph,
});

/** The outline of the gateway a person has not made yet. */
export const Basic = meta.story({});

/** The outlines at the height this build draws them, clear of the graph's edge by nine. */
export const Shape = meta.story({
  play: async ({ canvasElement }) => {
    const ghost = canvasElement.querySelector('svg');
    const outlines = [...(ghost?.querySelectorAll('rect') ?? [])];
    const drawn = paintedBox(ghost);

    await expect(drawn.width).toBe(436);
    await expect(drawn.height).toBe(114);
    await expect(outlines).toHaveLength(2);

    for (const outline of outlines) {
      const box = outline.getBBox();

      await expect(box.width).toBe(150);
      await expect(box.height).toBe(96);
      await expect(box.y).toBe(9);
      await expect(drawn.height - box.y - box.height).toBe(9);
    }
  },
});

function placedGlyphs(canvasElement: HTMLElement): SVGSVGElement[] {
  return [
    ...(canvasElement.querySelector('svg')?.querySelectorAll<SVGSVGElement>(':scope > svg') ?? []),
  ];
}

function drawnLabels(canvasElement: HTMLElement): Element[] {
  return [...(canvasElement.querySelector('svg')?.querySelectorAll('text') ?? [])];
}

/** Both outlines name their kind with a glyph, drawn a notch above the reference's sixteen. */
export const NodesCarryTheirGlyph = meta.story({
  play: async ({ canvasElement }) => {
    const glyphs = placedGlyphs(canvasElement);

    await expect(glyphs).toHaveLength(2);

    for (const glyph of glyphs) {
      await expect(glyph.width.baseVal.value).toBe(20);
      await expect(glyph.height.baseVal.value).toBe(20);
      await expect(paintedStyle(glyph.querySelector('svg')).strokeWidth).toBe('2px');
    }
  },
});

/** Each glyph stands over the label it belongs to, sharing the outline's centre line. */
export const GlyphsSitAboveTheirLabel = meta.story({
  play: async ({ canvasElement }) => {
    const glyphs = placedGlyphs(canvasElement);
    const labels = drawnLabels(canvasElement);

    await expect(labels).toHaveLength(2);

    for (const [place, glyph] of glyphs.entries()) {
      const drawn = paintedBox(glyph);
      const label = paintedBox(labels[place]);

      await expect(drawn.bottom).toBeLessThan(label.top);
      await expect(Math.abs(drawn.x + drawn.width / 2 - (label.x + label.width / 2))).toBeLessThan(
        1,
      );
    }
  },
});
