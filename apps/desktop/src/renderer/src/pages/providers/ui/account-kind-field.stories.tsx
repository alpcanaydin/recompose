import preview from '#.storybook/preview';

import { AccountKindField } from './account-kind-field';

const meta = preview.meta({
  component: AccountKindField,
});

/** Selector resting on the api-key kind. */
export const Basic = meta.story({
  args: { value: 'api-key', onChangeValue: () => {} },
});
