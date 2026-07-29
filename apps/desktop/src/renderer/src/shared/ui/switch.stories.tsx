import type { ComponentProps } from 'react';

import { useState } from 'react';
import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { Switch } from './index';

const meta = preview.meta({
  component: Switch,
});

function ControlledSwitch(args: ComponentProps<typeof Switch>) {
  const [checked, setChecked] = useState(args.checked);

  return <Switch {...args} checked={checked} onChangeChecked={setChecked} />;
}

/** The resting state of a setting nobody has turned on yet. */
export const Off = meta.story({
  args: { label: 'Show in menu bar', checked: false, onChangeChecked: () => {} },
  render: ControlledSwitch,
  play: async ({ canvas, userEvent }) => {
    const control = await canvas.findByRole('switch', { name: 'Show in menu bar' });

    await expect(control).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(control);

    await expect(control).toHaveAttribute('aria-checked', 'true');
    await expect(control).toHaveAccessibleName('Show in menu bar');
  },
});

/** A setting that is currently applied, naming itself the same way it does when off. */
export const On = meta.story({
  args: { label: 'Show in menu bar', checked: true, onChangeChecked: () => {} },
  render: ControlledSwitch,
  play: async ({ canvas }) => {
    const control = await canvas.findByRole('switch', { name: 'Show in menu bar' });

    await expect(control).toHaveAttribute('aria-checked', 'true');
  },
});

/** A setting whose machinery the app lacks: reachable and explained, never movable. */
export const Inert = meta.story({
  args: { label: 'Gateway autostart', checked: false, inert: true, onChangeChecked: () => {} },
  render: ControlledSwitch,
  play: async ({ canvas, userEvent }) => {
    const control = await canvas.findByRole('switch', { name: 'Gateway autostart' });

    await expect(control).toHaveAttribute('aria-disabled', 'true');
    await expect(control).not.toHaveAttribute('disabled');
    await expect(control).toHaveAttribute('tabindex', '0');

    await userEvent.click(control);

    await expect(control).toHaveAttribute('aria-checked', 'false');
  },
});

/** The same control under the dark scheme, where the track and thumb swap weight. */
export const DarkScheme = meta.story({
  args: { label: 'Show in menu bar', checked: true, onChangeChecked: () => {} },
  globals: { theme: 'dark' },
  render: ControlledSwitch,
});
