import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { SubscriptionsEmptyState } from './subscriptions-empty-state';

const meta = preview.meta({
  component: SubscriptionsEmptyState,
  args: { onAddProvider: () => undefined },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-column p-6">
        <Story />
      </div>
    ),
  ],
});

/**
 * The screen before anything is connected, explaining the kind before it asks for one.
 *
 * @summary The reading counts the controls, because the scenario this state answers to allows the
 * screen exactly one act. A second control here would make a first-time reader choose before the
 * sentence above has told them what they are choosing between.
 */
export const Empty = meta.story({
  play: async ({ canvas }) => {
    const acts = await canvas.findAllByRole('button');

    await expect(acts.map((act) => act.textContent)).toEqual(['Add provider']);
    await expect(await canvas.findByText(/A subscription account is/)).toBeVisible();
  },
});

/** The same state in the dark scheme, where the dashed edge has to stay readable as an edge. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
