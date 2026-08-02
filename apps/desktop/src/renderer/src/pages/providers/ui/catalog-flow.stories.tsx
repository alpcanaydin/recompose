import { expect, screen, waitFor } from 'storybook/test';

import preview from '#.storybook/preview';

import { CatalogFlow } from './catalog-flow';

const meta = preview.meta({
  component: CatalogFlow,
  args: { kind: 'subscription' as const, open: true, onOpenChange: () => undefined },
});

/**
 * The first step of the flow, standing the kind-locked grid inside the modal.
 *
 * @summary The reading walks the two steps: picking a plan trades the grid for that plan's
 * connect step, and the back control in the header hands the grid back.
 */
export const GridStep = meta.story({
  play: async ({ userEvent }) => {
    await expect(await screen.findByRole('button', { name: /^Claude/ })).toBeVisible();

    await userEvent.click(await screen.findByRole('button', { name: /^Claude/ }));

    await waitFor(async () => {
      await expect(
        await screen.findByRole('heading', { name: 'An account for Claude Code' }),
      ).toBeVisible();
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Back' }));

    await waitFor(async () => {
      await expect(await screen.findByRole('button', { name: /^Codex/ })).toBeVisible();
    });
  },
});

/** The flow in the dark scheme, where the cards lift off the sheet behind them. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
