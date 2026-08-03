import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { Badge } from '../index';

const meta = preview.meta({
  component: Badge,
  args: { children: 'Max' },
});

/** The plan an account holds, printed as one short word. */
export const Plan = meta.story({
  play: async ({ canvas }) => {
    const printed = await canvas.findByText('Max');

    await expect(Number.parseFloat(getComputedStyle(printed).fontSize)).toBe(11);
  },
});

/** The badge beside the name it qualifies, where the name stays the thing a person reads first. */
export const BesideAName = meta.story({
  render: (args) => (
    <h2 className="flex items-center gap-1.5 text-heading text-ink">
      Anthropic
      <Badge>{args.children}</Badge>
    </h2>
  ),
  play: async ({ canvas }) => {
    const name = await canvas.findByRole('heading', { name: 'Anthropic Max' });
    const badge = await canvas.findByText('Max');

    const nameSize = Number.parseFloat(getComputedStyle(name).fontSize);
    const badgeSize = Number.parseFloat(getComputedStyle(badge).fontSize);

    await expect(badgeSize).toBeLessThan(nameSize);
  },
});
