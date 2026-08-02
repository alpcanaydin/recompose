import { expect } from 'storybook/test';

import preview from '#.storybook/preview';
import { inProvidersColumn } from '#.storybook/providers-column';

import { CredentialedEmptyState } from './credentialed-empty-state';

const meta = preview.meta({
  component: CredentialedEmptyState,
  args: { kind: 'api-key' as const },
  decorators: [inProvidersColumn],
});

/**
 * The keys screen before any key is stored, explaining the kind without asking for it.
 *
 * @summary The reading asks for the sentence that says what a key is and refuses any control,
 * because the one act lives in the window strip.
 */
export const Keys = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/An API key is/)).toBeVisible();
    await expect(canvas.queryByRole('button')).toBeNull();
  },
});

/** The aggregators screen before any key is stored, whose sentence names the different yield. */
export const Aggregators = meta.story({
  args: { kind: 'aggregator' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/An aggregator key is/)).toBeVisible();
  },
});

/** The same state in the dark scheme, where the dashed edge has to stay readable as an edge. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
