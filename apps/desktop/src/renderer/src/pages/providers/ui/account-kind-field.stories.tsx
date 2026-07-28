import type { ComponentProps } from 'react';

import { useArgs } from 'storybook/preview-api';
import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { AccountKindField } from './account-kind-field';

const meta = preview.meta({
  component: AccountKindField,
});

/**
 * Selector resting on the api-key kind.
 *
 * @summary Acceptance drives this field by its combobox role and its Kind name, so both stay pinned.
 */
export const Basic = meta.story({
  args: { value: 'api-key', onChangeValue: () => {} },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('combobox', { name: 'Kind' })).toHaveValue('api-key');
  },
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
