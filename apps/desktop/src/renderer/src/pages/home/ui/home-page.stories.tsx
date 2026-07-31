import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { gatewaySeed, paintedBox } from '../../../shared/testing';
import { HomePage } from './home-page';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });

const meta = preview.meta({
  component: HomePage,
  args: { providerConnected: false, onCreateGateway: () => {} },
  decorators: [
    (Story) => (
      <div className="relative h-105 bg-surface-content">
        <Story />
      </div>
    ),
  ],
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
