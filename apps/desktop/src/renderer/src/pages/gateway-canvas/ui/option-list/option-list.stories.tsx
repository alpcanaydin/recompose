import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { OptionList } from './option-list';

const accounts = [
  {
    heading: 'Aggregators',
    options: [
      { id: 'a1', name: 'openrouter', mark: 'openrouter' as const, detail: '300+ models' },
      { id: 'a2', name: 'together', mark: 'together' as const },
    ],
  },
  {
    heading: 'API Keys',
    options: [{ id: 'a3', name: 'side key', mark: 'mistral' as const }],
  },
];

const manyModels = [
  {
    options: [
      'claude-haiku-4-5',
      'claude-sonnet-5',
      'claude-opus-5',
      'gpt-5',
      'gpt-5-mini',
      'llama3.2',
      'mistral-large',
    ].map((id) => ({ id, name: id })),
  },
];

const meta = preview.meta({
  component: OptionList,
  args: {
    groups: accounts,
    picked: undefined,
    onPick: () => {},
    searchLabel: 'Search accounts',
    nothingMatched: 'No account matches that.',
  },
  decorators: [
    (Story) => (
      <div className="mx-auto my-4 w-72 rounded-field-group bg-surface-card p-2">
        <Story />
      </div>
    ),
  ],
});

/**
 * A short list, which stands whole with no search over it.
 *
 * @summary Reach for this shape wherever a field holds a value nobody types. Every option is
 * visible, because a search is for narrowing a long list rather than for finding out what exists.
 */
export const Gathered = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Aggregators')).toBeVisible();
    await expect(await canvas.findByRole('button', { name: /openrouter/ })).toBeVisible();
    await expect(canvas.queryByRole('searchbox')).toBeNull();
  },
});

/** The option settled on, which reads as picked rather than merely last clicked. */
export const Picked = meta.story({
  args: { picked: 'a1' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: /openrouter/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  },
});

/**
 * A list long enough to hunt through, which grows a search of its own.
 *
 * @summary The search appears only past the point where a list stops reading at a glance, so a
 * short list never carries a control it does not need.
 */
export const Searchable = meta.story({
  args: { groups: manyModels, searchLabel: 'Search models', nothingMatched: 'No model matches.' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('searchbox', { name: 'Search models' })).toBeVisible();
  },
});

/** A search narrowing the offer, which drops a whole heading once nothing under it matches. */
export const Narrowed = meta.story({
  args: { groups: manyModels, searchLabel: 'Search models', nothingMatched: 'No model matches.' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByRole('searchbox', { name: 'Search models' }), 'gpt');

    await expect(await canvas.findByRole('button', { name: 'gpt-5-mini' })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'llama3.2' })).toBeNull();
  },
});

/** A search matching nothing, which says so rather than emptying itself in silence. */
export const NothingMatched = meta.story({
  args: { groups: manyModels, searchLabel: 'Search models', nothingMatched: 'No model matches.' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByRole('searchbox', { name: 'Search models' }), 'zzz');

    await expect(await canvas.findByText('No model matches.')).toBeVisible();
  },
});

/** The list in the dark scheme, where a picked row has to read against the box behind it. */
export const DarkScheme = meta.story({ args: { picked: 'a1' }, globals: { theme: 'dark' } });
