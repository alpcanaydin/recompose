import { useState } from 'react';
import { expect } from 'storybook/test';

import preview from '#.storybook/preview';
import { inSettingsColumn } from '#.storybook/settings-column';

import { FieldRow, Switch } from './index';

const meta = preview.meta({
  component: FieldRow,
  args: { label: 'Launch at login', control: null },
  decorators: [inSettingsColumn],
});

function LaunchSwitch({ inert = false }: { inert?: boolean }) {
  const [checked, setChecked] = useState(false);

  return (
    <Switch checked={checked} inert={inert} label="Launch at login" onChangeChecked={setChecked} />
  );
}

/** A live setting: a label, a supporting sentence, and the control that applies it. */
export const Basic = meta.story({
  args: {
    description: 'Starts recompose when you sign in.',
    control: <LaunchSwitch />,
  },
  play: async ({ canvas }) => {
    const control = await canvas.findByRole('switch', { name: 'Launch at login' });

    await expect(control).toHaveAccessibleDescription('Starts recompose when you sign in.');
  },
});

/** A write that failed: the row states what went wrong where a reader will hear it. */
export const WithStatus = meta.story({
  args: {
    status: "That change didn't save.",
    control: <LaunchSwitch />,
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('alert')).toHaveTextContent("That change didn't save.");
  },
});

/**
 * A setting waiting on machinery the app lacks.
 *
 * @summary The row stays reachable and says what it waits for instead of dropping out of reach.
 */
export const Inert = meta.story({
  args: {
    label: 'Gateway autostart',
    reason: 'Waiting on the engine.',
    inert: true,
    control: <Switch checked={false} inert label="Gateway autostart" onChangeChecked={() => {}} />,
  },
  play: async ({ canvas, userEvent }) => {
    const control = await canvas.findByRole('switch', { name: 'Gateway autostart' });

    await expect(control).toHaveAccessibleDescription('Waiting on the engine.');

    await userEvent.click(control);

    await expect(control).toHaveAttribute('aria-checked', 'false');
  },
});

/** The same row under the dark scheme. */
export const DarkScheme = meta.story({
  args: {
    description: 'Starts recompose when you sign in.',
    control: <LaunchSwitch />,
  },
  globals: { theme: 'dark' },
});
