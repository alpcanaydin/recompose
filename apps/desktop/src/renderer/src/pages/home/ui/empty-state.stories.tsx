import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { EmptyState } from './empty-state';

const meta = preview.meta({
  component: EmptyState,
  args: { onCreateGateway: () => {} },
});

/** The invitation a fresh install meets, carrying the one act worth taking on it. */
export const Basic = meta.story({
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { name: 'Create your first gateway', level: 1 }),
    ).toBeVisible();
    await expect(await canvas.findByRole('button', { name: 'Create Gateway' })).toBeVisible();
  },
});
