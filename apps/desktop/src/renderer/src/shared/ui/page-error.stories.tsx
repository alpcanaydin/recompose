import { expect, fn } from 'storybook/test';

import preview from '#.storybook/preview';

import { PageError } from './page-error';

const meta = preview.meta({
  component: PageError,
  args: { error: new Error('the settings document could not be read'), reset: fn() },
});

/** The failure names what went wrong and offers the way back. */
export const Basic = meta.story({
  play: async ({ canvas, args }) => {
    await expect(await canvas.findByText('the settings document could not be read')).toBeVisible();

    const retry = await canvas.findByRole('button', { name: 'Try again' });

    retry.click();

    await expect(args.reset).toHaveBeenCalled();
  },
});

/** The same failure under the dark scheme. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
