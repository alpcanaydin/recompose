import { expect, userEvent } from 'storybook/test';

import preview from '#.storybook/preview';
import { withSidebarSurface } from '#.storybook/sidebar-surface';

import { gatewaySeed, paintedBox, paintedStyle } from '../../../shared/testing';
import { GetStartedPanel } from './get-started-panel';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });

const meta = preview.meta({
  component: GetStartedPanel,
  parameters: { bridge: { gateways: [] } },
  decorators: [withSidebarSurface],
  beforeEach: () => {
    localStorage.clear();
  },
});

/** A fresh session with every step still ahead of it, standing on the first. */
export const FirstSession = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Create a gateway')).toHaveAttribute(
      'aria-current',
      'step',
    );
    await expect(await canvas.findByText('0 of 4')).toBeVisible();
  },
});

/** A session past its first gateway, with the current mark handed to the provider step. */
export const GatewayMade = meta.story({
  parameters: { bridge: { gateways: [codex] } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Connect a provider')).toHaveAttribute(
      'aria-current',
      'step',
    );
    await expect(await canvas.findByText('1 of 4')).toBeVisible();
  },
});

/** Folded down to the header and the progress line, which is all the reference keeps. */
export const Folded = meta.story({
  parameters: { bridge: { gateways: [codex] } },
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Get started' }));

    await expect(await canvas.findByText('1 of 4')).toBeVisible();
    await expect(canvas.queryByText('Create a gateway')).toBeNull();
    await expect(canvas.queryByRole('button', { name: 'Skip setup' })).toBeNull();
  },
});

/**
 * The block at the width the sidebar fixes, folded and open.
 *
 * @summary Geometry belongs here rather than in a browser test, because the vitest browser
 * project renders without the app stylesheet and reads every size class as inert.
 */
export const PanelShape = meta.story({
  parameters: { bridge: { gateways: [codex] } },
  play: async ({ canvas, canvasElement }) => {
    const heading = await canvas.findByRole('heading', { name: 'Get started' });
    const panel = canvasElement.querySelector('section');

    await expect(paintedBox(panel).width).toBe(220);
    await expect(paintedStyle(panel).borderRadius).toBe('11px');
    await expect(paintedStyle(panel).paddingLeft).toBe('12px');
    await expect(paintedStyle(heading).fontSize).toBe('13px');

    const open = paintedBox(panel).height;

    await userEvent.click(await canvas.findByRole('button', { name: 'Get started' }));

    const folded = paintedBox(canvasElement.querySelector('section')).height;

    await expect(folded).toBeLessThan(open);
    await expect(paintedBox(canvasElement.querySelector('section')).width).toBe(220);
  },
});
