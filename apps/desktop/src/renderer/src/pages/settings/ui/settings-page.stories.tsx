import { expect, waitFor } from 'storybook/test';

import preview from '#.storybook/preview';

import { SettingsPage } from './settings-page';

const meta = preview.meta({
  component: SettingsPage,
});

/** The settings column as it opens on a fresh install, every section in reading order. */
export const Basic = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    await expect(await canvas.findByRole('group', { name: 'Appearance' })).toBeInTheDocument();
    await expect(canvas.queryByRole('switch', { name: 'Require API token' })).toBeNull();
  },
});

/**
 * The column as the settings shortcut leaves it, with the focus ring already on the first
 * control a person can move.
 *
 * @summary Reach for it when checking where the keyboard route lands.
 */
export const OpenedByShortcut = meta.story({
  args: { focus: 'first-control' },
  play: async ({ canvas }) => {
    const placed = await canvas.findByRole('switch', { name: 'Launch at login' });

    await waitFor(async () => {
      await expect(placed).toHaveFocus();
    });
  },
});

/** The same column under the dark scheme, where each card lifts off the content surface. */
export const DarkScheme = meta.story({
  globals: { theme: 'dark' },
});
