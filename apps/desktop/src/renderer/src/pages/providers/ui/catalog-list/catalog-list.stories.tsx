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

/**
 * The keys grid: the two first-party keys that connect today, then the seven that follow.
 *
 * @summary Each card reads as the endpoint the key is spent against, and a card the release cannot
 * connect yet names what it waits on rather than hiding. The reading asks for the two live cards
 * and one inert one, because a person has to tell them apart before pressing anything.
 */
export const Keys = meta.story({
  args: { kind: 'api-key' as const },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: /Anthropic API/ })).toBeVisible();
    await expect(await canvas.findByRole('button', { name: /OpenAI API/ })).toBeVisible();
    await expect(await canvas.findByRole('button', { name: /Gemini API/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  },
});

/**
 * The aggregator grid: the one hosted catalog that connects, then the six that follow.
 *
 * @summary Five of the six sell their own open-model catalogs rather than routing onward, so each
 * Soon card says what it sells rather than repeating the destination's promise.
 */
export const Aggregators = meta.story({
  args: { kind: 'aggregator' as const },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: /^OpenRouter/ })).not.toHaveAttribute(
      'aria-disabled',
    );
    await expect(await canvas.findByRole('button', { name: /Cerebras/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  },
});

/**
 * The local grid: the one runtime this machine can serve, then the four that follow.
 *
 * @summary The destination reads like the other three now rather than standing entirely on Soon
 * rows, so the reading asks for a live Ollama card beside an inert one.
 */
export const LocalRuntimes = meta.story({
  args: { kind: 'local' as const },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: /^Ollama/ })).not.toHaveAttribute(
      'aria-disabled',
    );
    await expect(
      await canvas.findByRole('button', { name: /Custom local server/ }),
    ).toHaveAttribute('aria-disabled', 'true');
  },
});

/** The subscription grid in the dark scheme, where each card lifts off the sheet behind it. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });

/** The local grid in the dark scheme, where a quiet mark has to hold against a dark card. */
export const LocalDarkScheme = meta.story({
  args: { kind: 'local' as const },
  globals: { theme: 'dark' },
});
