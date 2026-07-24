import type { ComponentProps } from 'react';

import { useArgs } from 'storybook/preview-api';

import preview from '#.storybook/preview';

import { AccountKindField } from './account-kind-field';

const meta = preview.meta({
  component: AccountKindField,
});

/** Selector resting on the api-key kind. */
export const Basic = meta.story({
  args: { value: 'api-key', onChangeValue: () => {} },
  render: function Render(args) {
    const [{ value }, updateArgs] = useArgs<ComponentProps<typeof AccountKindField>>();

    return (
      <AccountKindField
        {...args}
        value={value}
        onChangeValue={(next) => {
          updateArgs({ value: next });
        }}
      />
    );
  },
});
