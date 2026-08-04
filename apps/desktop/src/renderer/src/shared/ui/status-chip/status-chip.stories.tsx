import { expect, within } from 'storybook/test';

import preview from '#.storybook/preview';

import { StatusChip } from '../index';

const transparent = 'rgba(0, 0, 0, 0)';

function markOf(chip: HTMLElement): Element {
  const mark = chip.querySelector('[aria-hidden="true"]');

  if (mark === null) {
    throw new Error('The status chip drew its word without a mark beside it.');
  }

  return mark;
}

const meta = preview.meta({
  component: StatusChip,
});

/** An account whose sign-in still holds, which asks nothing of anybody. */
export const Holding = meta.story({
  args: { word: 'Connected', tone: 'positive' },
  play: async ({ canvas }) => {
    const chip = await canvas.findByText('Connected');

    await expect(getComputedStyle(markOf(chip)).backgroundColor).not.toBe(transparent);
  },
});

/** An account whose sign-in lapsed, carrying the amber that asks a person to look. */
export const NeedsAttention = meta.story({
  args: { word: 'Needs sign-in', tone: 'attention' },
  play: async ({ canvas }) => {
    const chip = await canvas.findByText('Needs sign-in');

    await expect(getComputedStyle(markOf(chip)).backgroundColor).not.toBe(transparent);
  },
});

/** A standing that is a quiet fact rather than an alarm, like a server that isn't running. */
export const Quiet = meta.story({
  args: { word: 'Not running', tone: 'inert' },
  play: async ({ canvas }) => {
    const chip = await canvas.findByText('Not running');

    await expect(getComputedStyle(markOf(chip)).backgroundColor).not.toBe(transparent);
  },
});

/** The three standings together, where the mark tells them apart without the color doing the work. */
export const AllStandings = meta.story({
  render: () => (
    <div className="flex gap-4">
      <StatusChip tone="positive" word="Connected" />
      <StatusChip tone="attention" word="Needs sign-in" />
      <StatusChip tone="inert" word="Not running" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const holding = markOf(await canvas.findByText('Connected'));
    const lapsed = markOf(await canvas.findByText('Needs sign-in'));
    const quiet = markOf(await canvas.findByText('Not running'));

    await expect(getComputedStyle(holding).backgroundColor).not.toBe(
      getComputedStyle(lapsed).backgroundColor,
    );
    await expect(getComputedStyle(quiet).backgroundColor).not.toBe(
      getComputedStyle(holding).backgroundColor,
    );
    await expect(getComputedStyle(holding).width).toBe(getComputedStyle(lapsed).width);
    await expect(getComputedStyle(holding).width).toBe(getComputedStyle(quiet).width);
  },
});
