import type { ComponentProps } from 'react';

import { useArgs } from 'storybook/preview-api';

import preview from '#.storybook/preview';

import { TextField } from './text-field';

const meta = preview.meta({
  component: TextField,
});

function TextFieldStory(args: ComponentProps<typeof TextField>) {
  const [{ value }, updateArgs] = useArgs<ComponentProps<typeof TextField>>();

  return (
    <TextField
      {...args}
      value={value}
      onChangeValue={(next) => {
        updateArgs({ value: next });
      }}
    />
  );
}

/** Empty input waiting for a value. */
export const Empty = meta.story({
  args: { label: 'Provider', value: '', onChangeValue: () => {} },
  render: TextFieldStory,
});

/** Input carrying a typed value. */
export const Filled = meta.story({
  args: { label: 'Provider', value: 'anthropic', onChangeValue: () => {} },
  render: TextFieldStory,
});

/** Password variant masking the secret. */
export const Password = meta.story({
  args: { label: 'Secret', type: 'password', value: 'not-a-real-secret', onChangeValue: () => {} },
  render: TextFieldStory,
});
