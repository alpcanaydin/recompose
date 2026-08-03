import { expect } from 'storybook/test';

import preview from '#.storybook/preview';
import { withShellSurface } from '#.storybook/shell-surface';

import { UsagePage } from './usage-page';

const meta = preview.meta({
  component: UsagePage,
  decorators: [withShellSurface],
});

/**
 * The screen before any gateway has served a request, which is every screen today.
 *
 * @summary The row that reaches here is live rather than dimmed, so the surface behind it has to
 * carry its own account of why it holds no reading.
 */
export const NothingServedYet = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { level: 1, name: 'Usage' })).toBeVisible();
    await expect(
      await canvas.findByRole('heading', { level: 2, name: 'No requests yet' }),
    ).toBeVisible();
  },
});

/** The same screen in the dark scheme, where the empty card still reads as a surface. */
export const DarkScheme = meta.story({
  globals: { theme: 'dark' },
});
