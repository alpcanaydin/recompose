import { expect, fn } from 'storybook/test';

import preview from '#.storybook/preview';
import { inSettingsColumn } from '#.storybook/settings-column';

import { TokenActions } from './token-actions';

const meta = preview.meta({
  component: TokenActions,
  args: { masked: null, onCopy: fn(), onMint: fn() },
  decorators: [inSettingsColumn],
});

/** Before a value exists there is one act, and it names what it will make. */
export const NothingMinted = meta.story({
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.queryByRole('button', { name: 'Copy' })).toBeNull();

    await userEvent.click(canvas.getByRole('button', { name: 'Generate' }));

    await expect(args.onMint).toHaveBeenCalled();
  },
});

/** Once a value exists the row offers both acts, with the safe one first. */
export const Minted = meta.story({
  args: { masked: 'rc-local-••••••••9a3d' },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Copy' }));

    await expect(args.onCopy).toHaveBeenCalled();
    await expect(canvas.getByRole('button', { name: 'Regenerate' })).toBeVisible();
  },
});

/** The same cluster under the dark scheme. */
export const DarkScheme = meta.story({
  args: { masked: 'rc-local-••••••••9a3d' },
  globals: { theme: 'dark' },
});
