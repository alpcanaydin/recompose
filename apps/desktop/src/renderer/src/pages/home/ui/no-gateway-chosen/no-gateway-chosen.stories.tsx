import { expect } from 'storybook/test';

import preview from '#.storybook/preview';
import { withShellSurface } from '#.storybook/shell-surface';

import { paintedBox } from '../../../../shared/testing';
import { NoGatewayChosen } from './no-gateway-chosen';

const meta = preview.meta({ component: NoGatewayChosen, decorators: [withShellSurface] });

/**
 * What a person reads when the gateway they last opened has gone.
 *
 * @summary The way on is a sidebar row rather than anything on this surface, so the surface says
 * so. Painting nothing here would leave a screen reader with nothing to announce.
 */
export const Basic = meta.story({
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { name: 'Pick a gateway', level: 1 }),
    ).toBeVisible();
    await expect(await canvas.findByText('Choose one from the sidebar to see it.')).toBeVisible();
  },
});

/** The block sits on the middle of the surface it fills, the way the invitation beside it does. */
export const Centred = meta.story({
  play: async ({ canvas, canvasElement }) => {
    const heading = await canvas.findByRole('heading', { name: 'Pick a gateway' });
    const line = await canvas.findByText('Choose one from the sidebar to see it.');
    const surface = paintedBox(canvasElement.firstElementChild);
    const block = { top: paintedBox(heading).top, bottom: paintedBox(line).bottom };

    await expect(
      Math.abs((block.top + block.bottom) / 2 - (surface.top + surface.bottom) / 2),
    ).toBeLessThan(1);
  },
});
