import type { ComponentProps } from 'react';

import { useState } from 'react';
import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { TextField } from '../index';

const meta = preview.meta({
  component: TextField,
  args: { label: 'Provider', value: '', onChangeValue: () => {} },
});

function ControlledTextField(args: ComponentProps<typeof TextField>) {
  const [value, setValue] = useState(args.value);

  return <TextField {...args} value={value} onChangeValue={setValue} />;
}

/** Empty input waiting for a value. */
export const Empty = meta.story({
  render: ControlledTextField,
  play: async ({ canvas, userEvent }) => {
    const control = await canvas.findByRole('textbox', { name: 'Provider' });

    await userEvent.type(control, 'anthropic');

    await expect(control).toHaveValue('anthropic');
  },
});

/** Input carrying a typed value. */
export const Filled = meta.story({
  args: { value: 'anthropic' },
  render: ControlledTextField,
});

/** Password variant masking the secret while keeping its name. */
export const Password = meta.story({
  args: { label: 'Secret', type: 'password', value: 'not-a-real-secret' },
  render: ControlledTextField,
  play: async ({ canvas }) => {
    const control = await canvas.findByLabelText('Secret');

    await expect(control).toHaveAttribute('type', 'password');
  },
});

/** A field whose machinery the app lacks: reachable and explained, never editable. */
export const Inert = meta.story({
  args: { label: 'Bind address', value: '127.0.0.1', inert: true },
  render: ControlledTextField,
  play: async ({ canvas, userEvent }) => {
    const control = await canvas.findByRole('textbox', { name: 'Bind address' });

    await expect(control).toHaveAttribute('aria-disabled', 'true');
    await expect(control).not.toHaveAttribute('disabled');

    await userEvent.type(control, 'x');

    await expect(control).toHaveValue('127.0.0.1');
  },
});

/** The same input under the dark scheme. */
export const DarkScheme = meta.story({
  args: { value: 'anthropic' },
  globals: { theme: 'dark' },
  render: ControlledTextField,
});
