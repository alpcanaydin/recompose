import type { AccountsDocument } from '@recompose/contracts';

import { expect } from 'storybook/test';

import preview from '#.storybook/preview';
import { inProvidersColumn } from '#.storybook/providers-column';

import { LocalRuntimesSurface } from './local-runtimes-surface';

const runtimes: AccountsDocument = {
  schemaVersion: 4,
  accounts: [{ id: 'l1', provider: 'ollama', kind: 'local', address: 'http://127.0.0.1:11434' }],
};

const meta = preview.meta({
  component: LocalRuntimesSurface,
  decorators: [inProvidersColumn],
});

/**
 * The surface once a runtime is stored, standing as the list alone.
 *
 * @summary The reading asks for the row and its observed standing, because the surface adds
 * nothing of its own: the one act lives in the window strip rather than above the list.
 */
export const Connected = meta.story({
  parameters: {
    bridge: { accounts: runtimes, reachability: { verdict: 'answers' as const, version: '0.5.1' } },
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('http://127.0.0.1:11434')).toBeVisible();
    await expect(await canvas.findByText('Running')).toBeVisible();
  },
});

/**
 * The surface before any runtime connects, which trades the list for the explaining state.
 *
 * @summary The reading asks for the sentence, because the empty state is the whole surface here
 * rather than a note above an empty list.
 */
export const Empty = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/local runtime serves models/)).toBeVisible();
  },
});

/** The connected surface in the dark scheme, where the row lifts off the screen behind it. */
export const DarkScheme = meta.story({
  parameters: { bridge: { accounts: runtimes } },
  globals: { theme: 'dark' },
});
