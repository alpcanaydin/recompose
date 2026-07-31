import { expect } from 'storybook/test';

import preview from '#.storybook/preview';
import { withShellSurface } from '#.storybook/shell-surface';

import { gatewaySeed, paintedBox, paintedStyle } from '../../../shared/testing';
import { HomePage } from './home-page';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });

const meta = preview.meta({
  component: HomePage,
  args: { providerConnected: false, onCreateGateway: () => {} },
  decorators: [withShellSurface],
});

/** A fresh install: the invitation, with the coaching card floating beside it. */
export const FirstLaunch = meta.story({
  parameters: { bridge: { gateways: [] } },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { name: 'Create your first gateway', level: 1 }),
    ).toBeVisible();
    await expect(await canvas.findByRole('heading', { name: 'Get started' })).toBeVisible();
  },
});

/** Once a gateway exists the invitation leaves and the coaching carries on alone. */
export const GatewayMade = meta.story({
  parameters: { bridge: { gateways: [codex] } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: 'Get started' })).toBeVisible();
    await expect(canvas.queryByRole('heading', { name: 'Create your first gateway' })).toBeNull();
  },
});

/** The home surface is a canvas, so it carries the dot grid at the reference's tint and pitch. */
export const DottedCanvas = meta.story({
  parameters: { bridge: { gateways: [] } },
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByRole('heading', { name: 'Create your first gateway', level: 1 });

    const surface = canvasElement.firstElementChild?.firstElementChild;
    const tint = document.documentElement.classList.contains('scheme-dark')
      ? 'rgba(255, 255, 255, 0.06)'
      : 'rgba(0, 0, 0, 0.08)';

    await expect(paintedStyle(surface).backgroundSize).toBe('22px 22px');
    await expect(paintedStyle(surface).backgroundImage).toBe(
      `radial-gradient(circle, ${tint} 1px, rgba(0, 0, 0, 0) 1px)`,
    );
  },
});

/** The card sits where the reference pins it, clear of the surface it floats over. */
export const CardSitsInTheCorner = meta.story({
  parameters: { bridge: { gateways: [] } },
  play: async ({ canvas, canvasElement }) => {
    const card = await canvas.findByRole('heading', { name: 'Get started' });
    const surface = paintedBox(canvasElement.firstElementChild);
    const pinned = paintedBox(card.closest('section'));

    await expect(surface.right - pinned.right).toBe(16);
    await expect(surface.bottom - pinned.bottom).toBe(16);
  },
});
