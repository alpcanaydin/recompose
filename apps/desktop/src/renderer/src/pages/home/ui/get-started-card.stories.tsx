import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { GetStartedCard } from './get-started-card';

const meta = preview.meta({
  component: GetStartedCard,
  args: { gatewayExists: false, providerConnected: false, onSkip: () => {} },
});

/** A session that has done nothing yet, standing on the first step. */
export const FirstSession = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Create a gateway')).toHaveAttribute(
      'aria-current',
      'step',
    );
  },
});

/** A session past its first gateway, with the current mark handed to the provider step. */
export const GatewayMade = meta.story({
  args: { gatewayExists: true },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Connect a provider')).toHaveAttribute(
      'aria-current',
      'step',
    );
  },
});

/** Both steps this build can finish are done, leaving the two that name what they wait for. */
export const WaitingOnTheRest = meta.story({
  args: { gatewayExists: true, providerConnected: true },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Waits on the canvas.')).toBeVisible();
    await expect(await canvas.findByText('Waits on a virtual model.')).toBeVisible();
  },
});
