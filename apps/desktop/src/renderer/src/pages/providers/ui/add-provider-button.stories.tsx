import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { AddProviderButton } from './add-provider-button';

const meta = preview.meta({
  component: AddProviderButton,
  args: { onAddProvider: () => undefined },
});

/**
 * The one way into the catalog from a surface that already lists accounts.
 *
 * @summary The reading asks for the name, because every screen that lists accounts offers this
 * control once, and a control that renames itself per screen would read as a different act.
 */
export const Basic = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: 'Add provider' })).toBeVisible();
  },
});

/** The same control in the dark scheme, where the filled surface has to keep its standing. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
