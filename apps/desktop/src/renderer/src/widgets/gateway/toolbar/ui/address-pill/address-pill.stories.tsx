import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { AddressPill } from './address-pill';

const meta = preview.meta({
  component: AddressPill,
  args: {
    address: 'http://localhost:51234',
    port: 51234,
    status: 'running' as const,
  },
  decorators: [
    (Story) => (
      <div className="flex w-160 bg-surface-toolbar p-4">
        <Story />
      </div>
    ),
  ],
});

/**
 * The address a running gateway answers on, with the way to copy it whole.
 *
 * @summary The reading asks for the address, the state word, and the copy control, because the
 * pill is the one place a person reads where the gateway serves and whether it is serving.
 */
export const Running = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('localhost:51234')).toBeVisible();
    await expect(await canvas.findByText('Running')).toBeVisible();
    await expect(await canvas.findByRole('button', { name: 'Copy address' })).toBeVisible();
  },
});

/** The same pill while the gateway is stopped, whose state word says so. */
export const Stopped = meta.story({
  args: { status: 'stopped' as const },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Stopped')).toBeVisible();
  },
});

/** The same pill in the dark scheme, where the raised surface has to keep its edge. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
