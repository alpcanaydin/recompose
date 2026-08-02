import type { SubscriptionTool } from '@recompose/contracts';

import { expect, screen, userEvent } from 'storybook/test';

import preview from '#.storybook/preview';

import { ProviderCatalogDrawer } from './provider-catalog-drawer';

const claudeCode: SubscriptionTool = {
  provider: 'anthropic',
  toolName: 'Claude Code',
  present: true,
  signInCommand: 'claude',
  shellSetupLine: 'export CLAUDE_CONFIG_DIR="/tmp/anthropic/active"',
};

const meta = preview.meta({
  component: ProviderCatalogDrawer,
  args: { open: true, onOpenChange: () => undefined },
  parameters: { bridge: { tools: [claudeCode] } },
});

/**
 * The catalog standing open, with every provider it offers listed once.
 *
 * @summary A provider that connects two ways would otherwise stand under both headings, where the
 * second row reads as a second provider and opens the same fork as the first. The reading counts
 * the rows rather than trusting the grouping.
 */
export const Open = meta.story({
  play: async () => {
    const rows = await screen.findAllByRole('button', { name: /^(Anthropic|OpenAI|OpenRouter)$/ });

    await expect(rows).toHaveLength(3);
  },
});

/**
 * The catalog narrowed to keys, where the providers that lead with a plan gather anyway.
 *
 * @summary Anthropic leads with its subscription, so an unnarrowed catalog files it there. Asking
 * for keys has to gather it under keys rather than leave a heading a person asked for empty.
 */
export const NarrowedToKeys = meta.story({
  play: async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'API Keys' }));

    const headings = await screen.findAllByRole('heading', { level: 3 });

    await expect(headings.map((heading) => heading.textContent)).toEqual(['API Keys']);
    await expect(screen.queryByRole('button', { name: 'OpenRouter' })).toBeNull();
  },
});

/** A provider picked, whose ways take the place of the list and leave a way back to it. */
export const Picked = meta.story({
  play: async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Anthropic' }));

    await expect(await screen.findByRole('button', { name: 'All providers' })).toBeVisible();
    await expect(await screen.findByRole('button', { name: 'Sign in to Anthropic' })).toBeVisible();
  },
});

/** The same catalog in the dark scheme, where the panel lifts off the screen behind it. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
