import type { SubscriptionAccountView } from '@recompose/contracts';

import { expect } from 'storybook/test';

import preview from '#.storybook/preview';
import { inProvidersColumn } from '#.storybook/providers-column';

import { SubscriptionsSurface } from './subscriptions-surface';

const connected: SubscriptionAccountView = {
  id: 's1',
  provider: 'anthropic',
  label: 'Anthropic',
  signedInAs: 'dev@example.com',
  plan: 'Max',
  standing: 'connected',
  active: true,
};

const meta = preview.meta({
  component: SubscriptionsSurface,
  decorators: [inProvidersColumn],
});

/**
 * The surface once an account is connected, standing as the list alone.
 *
 * @summary The reading asks for the row and refuses a catalog control, because the one act lives
 * in the window strip rather than above the list.
 */
export const Connected = meta.story({
  parameters: { bridge: { subscriptions: [connected] } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('dev@example.com')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Add provider' })).toBeNull();
  },
});

/**
 * The surface before anything is connected, which trades the list for the explaining state.
 *
 * @summary The reading asks for the sentence, because the empty state is the whole surface here
 * rather than a note above an empty list.
 */
export const Empty = meta.story({
  parameters: { bridge: { subscriptions: [] } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/A subscription account is/)).toBeVisible();
  },
});

/** The connected surface in the dark scheme, where the row lifts off the screen behind it. */
export const DarkScheme = meta.story({
  parameters: { bridge: { subscriptions: [connected] } },
  globals: { theme: 'dark' },
});
