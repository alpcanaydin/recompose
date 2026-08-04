import { expect } from 'storybook/test';

import preview from '#.storybook/preview';
import { inProvidersColumn } from '#.storybook/providers-column';

import { LocalRuntimesEmptyState } from './local-runtimes-empty-state';

const meta = preview.meta({
  component: LocalRuntimesEmptyState,
  decorators: [inProvidersColumn],
});

/**
 * The destination before any runtime connects, explained rather than left blank.
 *
 * @summary The reading asks for the sentence naming what a local account holds, an address with
 * no credential behind it, so the first connect is never a guess.
 */
export const Default = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Nothing connected yet')).toBeVisible();
    await expect(await canvas.findByText(/no credential to store/)).toBeVisible();
  },
});

/** The same state in the dark scheme, where the dashed outline has to stay legible. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
