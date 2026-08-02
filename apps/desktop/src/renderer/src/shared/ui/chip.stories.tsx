import { useState } from 'react';
import { expect, userEvent } from 'storybook/test';

import preview from '#.storybook/preview';

import { Chip } from './index';

const meta = preview.meta({
  component: Chip,
  args: {
    selected: false,
    onSelectedChange: () => {},
    children: 'Subscriptions',
  },
});

/** A narrowing nobody asked for, which leaves the list as long as it was. */
export const Resting = meta.story({
  play: async ({ canvas }) => {
    const chip = await canvas.findByRole('button', { name: 'Subscriptions' });

    await expect(chip).toHaveAttribute('aria-pressed', 'false');
  },
});

/** The narrowing a person picked, told apart by its border and its weight as well as its fill. */
export const Selected = meta.story({
  args: { selected: true },
  play: async ({ canvas }) => {
    const chip = await canvas.findByRole('button', { name: 'Subscriptions' });
    const painted = getComputedStyle(chip);

    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(painted.borderTopWidth).toBe('1px');
    await expect(painted.fontWeight).toBe('500');
  },
});

/** The row of chips a catalog carries, where any number of them may stand at once. */
export const Row = meta.story({
  render: function KindFilters() {
    const [picked, setPicked] = useState<readonly string[]>(['Subscriptions']);

    return (
      <div className="flex gap-1.5">
        {['Subscriptions', 'API keys', 'Aggregators'].map((kind) => (
          <Chip
            key={kind}
            onSelectedChange={(selected) => {
              setPicked((held) =>
                selected ? [...held, kind] : held.filter((standing) => standing !== kind),
              );
            }}
            selected={picked.includes(kind)}
          >
            {kind}
          </Chip>
        ))}
      </div>
    );
  },
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Aggregators' }));

    await expect(await canvas.findByRole('button', { name: 'Subscriptions' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(await canvas.findByRole('button', { name: 'Aggregators' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  },
});
