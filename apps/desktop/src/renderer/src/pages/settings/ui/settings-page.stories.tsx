import { defaultSettings } from '@recompose/contracts';
import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { SettingsPage } from './settings-page';

const meta = preview.meta({
  component: SettingsPage,
});

/** The settings column as it opens on a fresh install, every section in reading order. */
export const Basic = meta.story({
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    await expect(canvas.getByRole('group', { name: 'Appearance' })).toBeInTheDocument();
  },
});

/**
 * The column with the token requirement already on, so the credential row stands under its switch.
 *
 * @summary The tallest the screen gets, and the one arrangement where a row appears mid-section.
 */
export const WithTokenRequired = meta.story({
  parameters: {
    bridge: {
      settings: { ...defaultSettings(), requireGatewayToken: true },
      overrides: {
        'gateway-token:status': async () =>
          Promise.resolve({
            ok: true,
            value: { masked: 'rc-local-••••••••9a3d', storage: 'available' },
          }),
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('rc-local-••••••••9a3d')).toBeInTheDocument();
    await expect(canvas.getByRole('switch', { name: 'Require API token' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  },
});

/** The same column under the dark scheme, where each card lifts off the content surface. */
export const DarkScheme = meta.story({
  globals: { theme: 'dark' },
  play: async () => {
    await expect(getComputedStyle(document.body).colorScheme).toBe('dark');
  },
});
