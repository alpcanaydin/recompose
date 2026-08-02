import { expect } from 'storybook/test';

import preview from '#.storybook/preview';
import { inProvidersColumn } from '#.storybook/providers-column';

import { SubscriptionsEmptyState } from './subscriptions-empty-state';

const meta = preview.meta({
  component: SubscriptionsEmptyState,
  decorators: [inProvidersColumn],
});

/**
 * The screen before anything is connected, explaining the kind without asking for it.
 *
 * @summary The reading asks for the sentence and refuses any control, because the one act lives
 * in the window strip and the sentence has to teach the kind before the act makes sense.
 */
export const Empty = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/A subscription account is/)).toBeVisible();
    await expect(canvas.queryByRole('button')).toBeNull();
  },
});

/** The same state in the dark scheme, where the dashed edge has to stay readable as an edge. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
