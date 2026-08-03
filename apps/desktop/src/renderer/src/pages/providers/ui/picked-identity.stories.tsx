import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { PickedIdentity } from './picked-identity';

const meta = preview.meta({
  component: PickedIdentity,
  args: { provider: 'anthropic' as const, title: 'Anthropic API' },
  decorators: [
    (Story) => (
      <div className="w-sheet p-4">
        <Story />
      </div>
    ),
  ],
});

/**
 * The picked product heading a connect step.
 *
 * @summary The reading asks for the heading under the product's name, because the identity is
 * what tells a person the pick carried over before any field asks for anything.
 */
export const Standing = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: 'Anthropic API' })).toBeVisible();
  },
});

/** The same identity in the dark scheme, where the mark's square lifts off the sheet. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
