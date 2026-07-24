import preview from '#.storybook/preview';

import { EmptyState } from './empty-state';

const meta = preview.meta({
  component: EmptyState,
});

/** The landing message a fresh install shows. */
export const Basic = meta.story({});
