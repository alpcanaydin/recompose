import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { gatewaySeed } from '../../../../shared/testing';
import { GatewayStage } from './gateway-stage';

const twoDefinitions = ['quick', 'deep'].map((name) => ({
  id: name,
  displayName: name,
  target: { accountId: 'k1', providerModel: `claude-${name}` },
}));

const serving = gatewaySeed({
  slug: 'my-gateway',
  displayName: 'My Gateway',
  port: 8397,
  virtualModels: twoDefinitions,
});

const meta = preview.meta({
  component: GatewayStage,
  args: { gateway: serving },
  decorators: [
    (Story) => (
      <div className="flex h-100 bg-surface-content">
        <Story />
      </div>
    ),
  ],
});

/**
 * The stage as it stands before the canvas exists: the gateway, and where to go instead.
 *
 * @summary The dotted field says nodes belong here and the hint says they do not arrive yet, so a
 * person reads an unfinished surface as unfinished rather than as broken.
 */
export const Standing = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('My Gateway')).toBeVisible();
    await expect(await canvas.findByText(':8397 · 2 virtual models')).toBeVisible();
    await expect(await canvas.findByText('Virtual models serve from the drawer')).toBeVisible();
  },
});

/** A gateway serving nothing yet, whose node says so rather than counting to zero. */
export const ServingNothing = meta.story({
  args: {
    gateway: gatewaySeed({ slug: 'my-gateway', displayName: 'My Gateway', port: 8397 }),
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(':8397 · no virtual models yet')).toBeVisible();
  },
});

/** The stage in the dark scheme, where the dotted field and the node edge both have to read. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
