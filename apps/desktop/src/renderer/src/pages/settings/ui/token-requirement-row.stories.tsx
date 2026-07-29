import type { GatewayTokenStatus } from '@recompose/contracts';

import { expect } from 'storybook/test';

import preview from '#.storybook/preview';
import { inFieldGroup, inSettingsColumn } from '#.storybook/settings-column';

import { TokenRequirementRow } from './token-requirement-row';

function storing(storage: GatewayTokenStatus['storage']) {
  return {
    bridge: {
      overrides: {
        'gateway-token:status': async () =>
          Promise.resolve({ ok: true, value: { masked: null, storage } }),
      },
    },
  };
}

const meta = preview.meta({
  component: TokenRequirementRow,
  decorators: [inFieldGroup('Server'), inSettingsColumn],
});

/** How the requirement ships: off, and saying nothing about the store behind it. */
export const RequirementOff = meta.story({
  parameters: storing('available'),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('switch', { name: 'Require API token' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await expect(canvas.queryByRole('alert')).toBeNull();
  },
});

/**
 * The machine has no keyring, so the warning stands whether or not a token exists yet.
 *
 * @summary Reach for this state when reviewing what recompose promises about secret storage.
 */
export const PlainTextWarning = meta.story({
  parameters: storing('plaintext-fallback'),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('alert')).toHaveTextContent(/plain text/i);
  },
});

/** A store the app cannot use at all: the requirement refuses to move and says why. */
export const StoreUnavailable = meta.story({
  parameters: storing('unavailable'),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('switch', { name: 'Require API token' }));

    await expect(await canvas.findByRole('alert')).toHaveTextContent(/credential store/i);
    await expect(await canvas.findByRole('switch', { name: 'Require API token' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  },
});

/** The same warning under the dark scheme, where the danger rule has to stay readable. */
export const DarkScheme = meta.story({
  globals: { theme: 'dark' },
  parameters: storing('plaintext-fallback'),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('alert')).toHaveTextContent(/plain text/i);
  },
});
