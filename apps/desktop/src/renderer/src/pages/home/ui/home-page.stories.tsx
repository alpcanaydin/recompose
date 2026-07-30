import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { gatewaySeed } from '../../../shared/testing';
import { HomePage } from './home-page';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });

const meta = preview.meta({
  component: HomePage,
  args: { providerConnected: false, onCreateGateway: () => {} },
  decorators: [
    (Story) => (
      <div className="h-105 bg-surface-content p-6">
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
