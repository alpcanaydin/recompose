import type { ComponentProps } from 'react';

import { useState } from 'react';
import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { TextField } from './index';

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
    const control = canvas.getByRole('textbox', { name: 'Provider' });

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
    const control = canvas.getByLabelText('Secret');

    await expect(control).toHaveAttribute('type', 'password');
  },
});

/** The same input under the dark scheme. */
export const DarkScheme = meta.story({
  args: { value: 'anthropic' },
  globals: { theme: 'dark' },
  render: ControlledTextField,
});
