import { expect } from 'storybook/test';

import preview from '#.storybook/preview';
import { inProvidersColumn } from '#.storybook/providers-column';

import { KindEmptyState } from './kind-empty-state';

const meta = preview.meta({
  component: KindEmptyState,
  args: {
    explanation:
      "An API key is a secret one provider gives you, and a gateway spends it request by request against that provider's own endpoint.",
    title: 'Nothing connected yet',
  },
  decorators: [inProvidersColumn],
});

/**
 * The shape every empty kind shares: a heading, one sentence, and no act of its own.
 *
 * @summary The reading refuses any control, because the one act lives in the window strip
 * and a second control here would make a first-time reader choose between two ways in.
 */
export const Basic = meta.story({
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button')).toBeNull();
    await expect(await canvas.findByText(/An API key is/)).toBeVisible();
    await expect(
      await canvas.findByRole('heading', { name: 'Nothing connected yet' }),
    ).toBeVisible();
  },
});

/** The same state in the dark scheme, where the dashed edge has to stay readable as an edge. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
