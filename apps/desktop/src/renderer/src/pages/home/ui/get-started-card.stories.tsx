import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { paintedBox, paintedStyle } from '../../../shared/testing';
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
    await expect(await canvas.findByText('0 of 4')).toBeVisible();
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
    await expect(await canvas.findByText('1 of 4')).toBeVisible();
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

/** The card at the size the reference pins it, which its content must not stretch. */
export const CardShape = meta.story({
  args: { gatewayExists: true },
  play: async ({ canvas, canvasElement }) => {
    const heading = await canvas.findByRole('heading', { name: 'Get started' });
    const card = canvasElement.querySelector('section');

    await expect(paintedBox(card).width).toBe(250);
    await expect(paintedStyle(card).borderRadius).toBe('11px');
    await expect(paintedStyle(card).paddingTop).toBe('12px');
    await expect(paintedStyle(card).paddingLeft).toBe('12px');
    await expect(paintedStyle(card).paddingBottom).toBe('6px');

    await expect(paintedStyle(heading).fontSize).toBe('13px');
    await expect(paintedStyle(heading).fontWeight).toBe('600');

    const step = (await canvas.findByText('Connect a provider')).closest('li');

    await expect(paintedStyle(step).minHeight).toBe('30px');
    await expect(paintedStyle(step).columnGap).toBe('9px');
    await expect(paintedBox(step?.querySelector('span')).width).toBe(15);
  },
});
