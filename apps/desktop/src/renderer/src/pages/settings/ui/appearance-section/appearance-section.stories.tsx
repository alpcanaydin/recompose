import { expect } from 'storybook/test';

import preview from '#.storybook/preview';
import { inSettingsColumn } from '#.storybook/settings-column';

import { AppearanceSection } from './appearance-section';

const meta = preview.meta({
  component: AppearanceSection,
  decorators: [inSettingsColumn],
});

/** The theme choice standing on its own, the only appearance recompose decides. */
export const Basic = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('radiogroup', { name: 'Theme' })).toBeVisible();
    await expect(canvas.queryByRole('switch', { name: 'Reduce wire motion' })).toBeNull();
  },
});

/** Choosing a theme moves the selection to the segment the person picked. */
export const ChoosingDark = meta.story({
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('radio', { name: 'Dark' }));

    await expect(await canvas.findByRole('radio', { name: 'Dark' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  },
});

/** The same group under the dark scheme, where the selected segment has to stay legible. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
