import { expect, fn, waitFor } from 'storybook/test';

import preview from '#.storybook/preview';
import { inSettingsColumn } from '#.storybook/settings-column';

import { TokenConfirmation } from './token-confirmation';

const meta = preview.meta({
  component: TokenConfirmation,
  args: { onCancel: fn(), onConfirm: fn() },
  decorators: [inSettingsColumn],
});

/** The safe choice takes focus as the confirmation opens, so a stray Return cancels. */
export const Open = meta.story({
  play: async ({ canvas }) => {
    const placed = await canvas.findByRole('button', { name: 'Cancel' });

    await waitFor(async () => {
      await expect(placed).toHaveFocus();
    });
    await expect(await canvas.findByRole('button', { name: 'Regenerate' })).toBeVisible();
  },
});

/** Confirming is a deliberate second act, never the one focus lands on. */
export const Confirming = meta.story({
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Regenerate' }));

    await expect(args.onConfirm).toHaveBeenCalled();
    await expect(args.onCancel).not.toHaveBeenCalled();
  },
});

/** The same pair under the dark scheme, where the destructive tone has to hold its own. */
export const DarkScheme = meta.story({
  globals: { theme: 'dark' },
});
