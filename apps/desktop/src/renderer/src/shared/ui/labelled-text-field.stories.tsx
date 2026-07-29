import { useState } from 'react';
import { expect } from 'storybook/test';

import preview from '#.storybook/preview';
import { inSettingsColumn } from '#.storybook/settings-column';

import { LabelledTextField } from './labelled-text-field';

const meta = preview.meta({
  component: LabelledTextField,
  args: { label: 'Provider', value: '', onChangeValue: () => {} },
  decorators: [inSettingsColumn],
});

function DraftField({ label, type }: { label: string; type?: 'password' | 'text' }) {
  const [value, setValue] = useState('');

  return <LabelledTextField label={label} onChangeValue={setValue} type={type} value={value} />;
}

/** The label belongs to the field, so clicking it puts the caret in the input. */
export const Basic = meta.story({
  render: () => <DraftField label="Provider" />,
  play: async ({ canvas, userEvent }) => {
    const label = await canvas.findByText('Provider');

    await userEvent.click(label);

    await expect(await canvas.findByRole('textbox', { name: 'Provider' })).toHaveFocus();
  },
});

/** A secret masks what it holds while still naming itself. */
export const Secret = meta.story({
  render: () => <DraftField label="Secret" type="password" />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByText('Secret'));
    await userEvent.keyboard('not-a-real-secret');

    await expect(await canvas.findByLabelText('Secret')).toHaveValue('not-a-real-secret');
  },
});

/** The same field under the dark scheme. */
export const DarkScheme = meta.story({
  globals: { theme: 'dark' },
  render: () => <DraftField label="Provider" />,
});
