import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { Way } from './way';

const meta = preview.meta({
  component: Way,
  args: {
    yields: 'A target a gateway can reach',
    children: <p className="text-detail text-ink-secondary">The arm explains itself here.</p>,
  },
  decorators: [
    (Story) => (
      <div className="w-drawer p-4">
        <Story />
      </div>
    ),
  ],
});

/**
 * One arm of the connect fork, named after what connecting through it yields.
 *
 * @summary The reading asks for the landmark and its name, because a person choosing between two
 * arms chooses between two yields, and a screen reader has to hear the yield to choose at all.
 */
export const Basic = meta.story({
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('region', { name: 'A target a gateway can reach' }),
    ).toBeVisible();
  },
});

/** The same arm in the dark scheme, where the card lifts off the drawer behind it. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
