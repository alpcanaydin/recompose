import { expect } from 'storybook/test';

import preview from '#.storybook/preview';
import { inSettingsColumn } from '#.storybook/settings-column';
import { reportingSystem } from '#.storybook/system-report';

import { GeneralSection } from './general-section';

const meta = preview.meta({
  component: GeneralSection,
  parameters: reportingSystem(),
  decorators: [inSettingsColumn],
});

/** A packaged build on a platform that carries login items: every row live. */
export const Basic = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('switch', { name: 'Launch at login' })).toBeVisible();
    await expect(await canvas.findByRole('switch', { name: 'Show in menu bar' })).toBeVisible();
  },
});

/** A development build: the row stays reachable and names why it cannot move. */
export const UnpackagedBuild = meta.story({
  parameters: reportingSystem({ loginItem: 'unpackaged' }),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('switch', { name: 'Launch at login' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  },
});

/** A platform with no login item at all, where the row is absent rather than dimmed. */
export const NoLoginItem = meta.story({
  parameters: reportingSystem({ loginItem: 'unsupported' }),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('switch', { name: 'Show in menu bar' })).toBeVisible();

    await expect(canvas.queryByRole('switch', { name: 'Launch at login' })).toBeNull();
  },
});

/** The same group under the dark scheme. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
