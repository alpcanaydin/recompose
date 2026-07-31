import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { paintedBox, paintedStyle } from '../../../shared/testing';
import { StatusBar } from './status-bar';

const meta = preview.meta({
  component: StatusBar,
});

/** The band under the canvas, reading zero everywhere because nothing has flowed yet. */
export const Basic = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('req/min', { exact: false })).toBeVisible();
    await expect(await canvas.findByText('clients', { exact: false })).toBeVisible();
    await expect(await canvas.findByText('today', { exact: false })).toBeVisible();
    await expect(await canvas.findByText('wires', { exact: false })).toBeVisible();
  },
});

/** The band at the height and rhythm the reference fixes for it. */
export const BandShape = meta.story({
  play: async ({ canvas, canvasElement }) => {
    const band = canvasElement.querySelector('footer');
    const meter = await canvas.findByText('clients', { exact: false });

    await expect(paintedBox(band).height).toBe(38);
    await expect(paintedStyle(band).columnGap).toBe('14px');
    await expect(paintedStyle(band).paddingLeft).toBe('14px');
    await expect(paintedStyle(band).borderTopWidth).toBe('1px');
    await expect(paintedStyle(meter).fontSize).toBe('11px');
  },
});
