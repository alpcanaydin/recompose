import preview from '#.storybook/preview';

import { TextField } from './text-field';

const meta = preview.meta({
  component: TextField,
});

/** Empty input waiting for a value. */
export const Empty = meta.story({
  args: { label: 'Provider', value: '', onChangeValue: () => {} },
});

/** Input carrying a typed value. */
export const Filled = meta.story({
  args: { label: 'Provider', value: 'anthropic', onChangeValue: () => {} },
});

/** Password variant masking the secret. */
export const Password = meta.story({
  args: { label: 'Secret', type: 'password', value: 'not-a-real-secret', onChangeValue: () => {} },
});
