import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import type { BrandMarkName } from './index';

import { BrandMark } from './index';

const catalog: BrandMarkName[] = ['anthropic', 'openai', 'openrouter'];

const meta = preview.meta({
  component: BrandMark,
});

/** Every mark the set carries, which is every provider this build can list. */
export const EveryMark = meta.story({
  render: () => (
    <ul className="flex list-none gap-6 p-0">
      {catalog.map((name) => (
        <li className="flex flex-col items-center gap-1.5 text-ink" key={name}>
          <BrandMark name={name} />
          <span className="text-caption text-ink-secondary">{name}</span>
        </li>
      ))}
    </ul>
  ),
  play: async ({ canvasElement }) => {
    const drawn = [...canvasElement.querySelectorAll('svg')];
    const shapes = new Set(drawn.map((mark) => mark.textContent));

    await expect(shapes.size).toBe(catalog.length);

    for (const mark of drawn) {
      await expect(mark).toHaveAttribute('aria-hidden');
    }
  },
});

/** The mark leading a provider's name, which keeps that name the only thing announced. */
export const LeadingARow = meta.story({
  args: { name: 'anthropic' },
  render: (args) => (
    <h2 className="flex items-center gap-2 text-heading text-ink">
      <BrandMark name={args.name} />
      Anthropic
    </h2>
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: 'Anthropic' })).toBeVisible();
  },
});
