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
 * The shape every empty kind shares, with the one act a connectable kind offers.
 *
 * @summary The reading counts the controls, because the scenario this state answers to allows the
 * screen exactly one act. A second control here would make a first-time reader choose before the
 * sentence above has told them what they are choosing between.
 */
export const WithAct = meta.story({
  args: {
    action: (
      <button className="push-button-primary focus-ring" type="button">
        Add provider
      </button>
    ),
  },
  play: async ({ canvas }) => {
    const acts = await canvas.findAllByRole('button');

    await expect(acts.map((act) => act.textContent)).toEqual(['Add provider']);
    await expect(await canvas.findByText(/An API key is/)).toBeVisible();
    await expect(
      await canvas.findByRole('heading', { name: 'Nothing connected yet' }),
    ).toBeVisible();
  },
});

/**
 * The same shape where nothing can be connected yet, which offers no act at all.
 *
 * @summary A destination that promises nothing is the honest half of showing the row at all, so
 * the state stands on the heading and the sentence alone.
 */
export const Awaiting = meta.story({
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button')).toBeNull();
    await expect(await canvas.findByText(/An API key is/)).toBeVisible();
  },
});

/** The same state in the dark scheme, where the dashed edge has to stay readable as an edge. */
export const DarkScheme = meta.story({
  args: {
    action: (
      <button className="push-button-primary focus-ring" type="button">
        Add provider
      </button>
    ),
  },
  globals: { theme: 'dark' },
});
