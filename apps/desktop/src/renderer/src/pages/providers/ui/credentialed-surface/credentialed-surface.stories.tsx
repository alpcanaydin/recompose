import type { AccountsDocument } from '@recompose/contracts';

import { expect } from 'storybook/test';

import preview from '#.storybook/preview';
import { inProvidersColumn } from '#.storybook/providers-column';

import { CredentialedSurface } from './credentialed-surface';

const keys: AccountsDocument = {
  schemaVersion: 3,
  accounts: [
    { id: 'a9', provider: 'anthropic', kind: 'api-key', label: 'Team key', credentialRef: 'c9' },
  ],
};

const meta = preview.meta({
  component: CredentialedSurface,
  args: { kind: 'api-key' as const },
  decorators: [inProvidersColumn],
});

/**
 * The surface once a key is stored, standing as the list alone.
 *
 * @summary The reading asks for the row and refuses a catalog control, because the one act lives
 * in the window strip rather than above the list.
 */
export const Connected = meta.story({
  parameters: { bridge: { accounts: keys } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Team key')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Add provider' })).toBeNull();
  },
});

/**
 * The surface before any key is stored, which trades the list for the explaining state.
 *
 * @summary The reading asks for the sentence, because the empty state is the whole surface here
 * rather than a note above an empty list.
 */
export const Empty = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/An API key is/)).toBeVisible();
  },
});

/** The connected surface in the dark scheme, where the row lifts off the screen behind it. */
export const DarkScheme = meta.story({
  parameters: { bridge: { accounts: keys } },
  globals: { theme: 'dark' },
});
