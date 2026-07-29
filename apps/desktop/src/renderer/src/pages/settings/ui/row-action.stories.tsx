import { expect, fn } from 'storybook/test';

import preview from '#.storybook/preview';
import { inSettingsColumn } from '#.storybook/settings-column';

import { RowAction } from './row-action';

const noop = () => {};

const meta = preview.meta({
  component: RowAction,
  args: { children: 'Reveal in Finder', onClick: fn() },
  decorators: [inSettingsColumn],
});

/** The button a row carries beside its label, for an act that changes nothing on its own. */
export const Plain = meta.story({
  play: async ({ args, canvas, userEvent }) => {
    const button = await canvas.findByRole('button', { name: 'Reveal in Finder' });

    await userEvent.click(button);

    await expect(args.onClick).toHaveBeenCalled();
  },
});

/** An act that destroys something, which reads red without shouting. */
export const Destructive = meta.story({
  args: { children: 'Regenerate', tone: 'destructive' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: 'Regenerate' })).toBeVisible();
  },
});

/** Both tones side by side, so the weight between them stays deliberate. */
export const BothTones = meta.story({
  render: () => (
    <div className="flex gap-2">
      <RowAction onClick={noop}>Cancel</RowAction>
      <RowAction onClick={noop} tone="destructive">
        Regenerate
      </RowAction>
    </div>
  ),
});

/** The same buttons under the dark scheme, where the bezel carries the shape. */
export const DarkScheme = meta.story({
  globals: { theme: 'dark' },
  render: () => (
    <div className="flex gap-2">
      <RowAction onClick={noop}>Copy</RowAction>
      <RowAction onClick={noop} tone="destructive">
        Regenerate
      </RowAction>
    </div>
  ),
});
