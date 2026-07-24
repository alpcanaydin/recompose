import preview from '#.storybook/preview';

import { ConnectAccountForm } from './connect-account-form';

const meta = preview.meta({
  component: ConnectAccountForm,
});

/** Blank connection form ready for a new provider account. */
export const Blank = meta.story({});
