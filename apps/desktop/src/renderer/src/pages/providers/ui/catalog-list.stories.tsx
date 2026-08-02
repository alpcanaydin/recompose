import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { CatalogList } from './catalog-list';

const meta = preview.meta({
  component: CatalogList,
  args: { kind: 'subscription' as const, onPick: () => undefined },
  decorators: [
    (Story) => (
      <div className="w-sheet-wide p-4">
        <Story />
      </div>
    ),
  ],
});

/**
 * The subscription grid: the two plans that connect today, then the five that follow.
 *
 * @summary The reading asks for a live Claude card and a disabled Copilot card, because the
 * catalog says what it grows toward rather than hiding it, and a person must be able to tell the
 * two apart before pressing anything.
 */
export const Subscriptions = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: /^Claude/ })).not.toHaveAttribute(
      'aria-disabled',
    );
    await expect(await canvas.findByRole('button', { name: /GitHub Copilot/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  },
});

/** The keys grid, where each card reads as the endpoint the key is spent against. */
export const Keys = meta.story({
  args: { kind: 'api-key' as const },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: /Anthropic API/ })).toBeVisible();
    await expect(await canvas.findByRole('button', { name: /OpenAI API/ })).toBeVisible();
  },
});

/** The local grid, standing entirely on the servers that connect later. */
export const Local = meta.story({
  args: { kind: 'local' as const },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: /Ollama/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  },
});

/** The subscription grid in the dark scheme, where each card lifts off the sheet behind it. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
