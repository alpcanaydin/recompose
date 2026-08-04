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

/**
 * The key step of the flow, standing the picked product centered over its two fields.
 *
 * @summary The reading proves the pick trades the grid for the form: the product heads the page
 * in the mark-and-heading anatomy the subscription step ships, each field hints the shape it
 * takes, and the connect act rides the sheet's foot beside Cancel rather than the body.
 */
export const KeyStep = meta.story({
  args: { kind: 'api-key' as const },
  play: async ({ userEvent }) => {
    await userEvent.click(await screen.findByRole('button', { name: /Anthropic API/ }));

    await waitFor(async () => {
      await expect(await screen.findByRole('heading', { name: 'Anthropic API' })).toBeVisible();
    });

    await expect(await screen.findByLabelText('Key')).toHaveAttribute('placeholder', 'sk-ant-…');
    await expect(await screen.findByRole('button', { name: 'Connect' })).toBeVisible();
  },
});

/**
 * The detect step of the flow, standing the verdict slot over the sheet's own foot acts.
 *
 * @summary The reading proves the pick trades the grid for the look without a button in between,
 * and the settle acts ride the sheet's foot: Check again leads on silence, Add anyway stands
 * beside it as a plain act.
 */
export const DetectStep = meta.story({
  args: { kind: 'local' as const },
  play: async ({ userEvent }) => {
    await userEvent.click(await screen.findByRole('button', { name: /^Ollama/ }));

    await waitFor(async () => {
      await expect(await screen.findByText(/isn't running at 127.0.0.1:11434/)).toBeVisible();
    });

    await expect(await screen.findByRole('button', { name: 'Check again' })).toBeVisible();
    await expect(await screen.findByRole('button', { name: 'Add anyway' })).toBeVisible();
  },
});

/** The flow in the dark scheme, where the cards lift off the sheet behind them. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
