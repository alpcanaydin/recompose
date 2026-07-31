import { expect } from 'storybook/test';

import preview from '#.storybook/preview';
import { withShellSurface } from '#.storybook/shell-surface';

import { paintedStyle } from '../../../shared/testing';
import { GatewayCanvasPage } from './gateway-canvas-page';

const meta = preview.meta({
  component: GatewayCanvasPage,
  args: { slug: 'codex' },
  decorators: [withShellSurface],
});

/** The surface a selected gateway composes on, before any node exists to compose. */
export const Basic = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: 'codex' })).toBeVisible();
  },
});

/** A canvas route is dotted, so the surface reads as somewhere nodes can be placed. */
export const DottedCanvas = meta.story({
  play: async ({ canvasElement }) => {
    const surface = canvasElement.firstElementChild?.firstElementChild;

    await expect(paintedStyle(surface).backgroundSize).toBe('22px 22px');
    await expect(paintedStyle(surface).backgroundImage).toContain('radial-gradient(circle,');
  },
});
