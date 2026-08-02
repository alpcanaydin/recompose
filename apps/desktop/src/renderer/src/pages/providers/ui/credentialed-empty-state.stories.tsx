import { expect } from 'storybook/test';

import preview from '#.storybook/preview';
import { inProvidersColumn } from '#.storybook/providers-column';

import { CredentialedEmptyState } from './credentialed-empty-state';

const meta = preview.meta({
  component: CredentialedEmptyState,
  args: { kind: 'api-key' as const, onAddProvider: () => undefined },
  decorators: [inProvidersColumn],
});

/**
 * The keys screen before any key is stored, explaining the kind before it asks for one.
 *
 * @summary The reading counts the controls, because the scenario this state answers to allows the
 * screen exactly one act, and it asks for the sentence that says what a key is before the act.
 */
export const Keys = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/An API key is/)).toBeVisible();
    await expect(await canvas.findByRole('button', { name: 'Add provider' })).toBeVisible();
    await expect(canvas.queryAllByRole('button')).toHaveLength(1);
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
