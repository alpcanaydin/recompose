import { expect, screen, userEvent } from 'storybook/test';

import preview from '#.storybook/preview';

import type { AccountKind } from '../../../entities/account';

import { AddProviderAct } from './add-provider-act';

const subscriptionKind: AccountKind = 'subscription';

const meta = preview.meta({
  component: AddProviderAct,
  args: { kind: subscriptionKind },
  decorators: [
    (Story) => (
      <div className="flex items-center justify-end bg-surface-toolbar p-4">
        <Story />
      </div>
    ),
  ],
});

/**
 * The act as the window strip carries it, a named control at the trailing edge.
 *
 * @summary The reading asks for the name beside the plus, because the one way into the catalog
 * has to say what it adds rather than stand as a symbol a first visit can't read.
 */
export const Standing = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: 'Add provider' })).toBeVisible();
  },
});

/**
 * The catalog the act opens, locked to the kind the screen behind holds.
 *
 * @summary Pressing the act is the whole interaction the strip owns, so the story proves the
 * press lands in the catalog rather than merely toggling state nothing shows.
 */
export const CatalogOpen = meta.story({
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Add provider' }));

    await expect(await screen.findByRole('dialog', { name: 'Add provider' })).toBeVisible();
  },
});

/** The act over a keys screen in the dark scheme, where the raised control keeps its edge. */
export const DarkScheme = meta.story({
  args: { kind: 'api-key' },
  globals: { theme: 'dark' },
});
