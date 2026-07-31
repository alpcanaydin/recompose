import { expect } from 'storybook/test';

import preview from '#.storybook/preview';
import { withShellSurface } from '#.storybook/shell-surface';

import { gatewaySeed, paintedStyle } from '../../../shared/testing';
import { HomePage } from './home-page';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });

const meta = preview.meta({
  component: HomePage,
  args: { onCreateGateway: () => {} },
  decorators: [withShellSurface],
});

/** A fresh install, where the invitation is the whole surface. */
export const FirstLaunch = meta.story({
  parameters: { bridge: { gateways: [] } },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { name: 'Create your first gateway', level: 1 }),
    ).toBeVisible();
  },
});

/** Once a gateway exists the invitation leaves, and nothing sends a person back here. */
export const GatewayMade = meta.story({
  parameters: { bridge: { gateways: [codex] } },
  play: async ({ canvas, canvasElement }) => {
    const surface = canvasElement.firstElementChild?.firstElementChild;

    await expect(paintedStyle(surface).backgroundSize).toBe('22px 22px');
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
