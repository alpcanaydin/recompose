import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import type { BrandMarkVariant } from '../index';

import { BrandMark, brandMarkNames } from '../index';

const meta = preview.meta({
  component: BrandMark,
  args: { name: 'anthropic' as const },
});

function inventory(variant: BrandMarkVariant, ink: string) {
  return (
    <ul className={`grid list-none grid-cols-7 gap-5 p-0 ${ink}`}>
      {brandMarkNames.map((name) => (
        <li className="flex flex-col items-center gap-1.5" key={name}>
          <BrandMark name={name} variant={variant} />
          <span className="text-caption text-ink-secondary">{name}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Every vendor mark the catalog can draw, in the vendor's own colors.
 *
 * @summary The reading a connectable card gets: a person scanning the catalog finds the row by its
 * logo before reading a word, so no two vendors may share a drawing.
 */
export const EveryMark = meta.story({
  render: () => inventory('color', 'text-ink'),
  play: async ({ canvasElement }) => {
    const drawn = [...canvasElement.querySelectorAll('svg')];
    const shapes = new Set(drawn.map((mark) => mark.innerHTML));

    await expect(shapes.size).toBe(brandMarkNames.length);

    for (const mark of drawn) {
      await expect(mark).toHaveAttribute('aria-hidden');
    }
  },
});

/**
 * The same inventory drawn on the quiet ink an inert row carries.
 *
 * @summary The reading a Soon card gets. Nothing dims by opacity here, so each mark takes the
 * row's own tertiary ink and the badge beside it keeps full strength.
 */
export const EveryMarkInMono = meta.story({
  render: () => inventory('mono', 'text-ink-tertiary'),
  play: async ({ canvasElement }) => {
    const drawn = [...canvasElement.querySelectorAll('svg')];

    for (const mark of drawn) {
      await expect(getComputedStyle(mark).fill).toBe(getComputedStyle(mark).color);
    }
  },
});

/** The mark leading a provider's name, which keeps that name the only thing announced. */
export const LeadingARow = meta.story({
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

/** The colored inventory in the dark scheme, where a monochrome mark flips with the ink. */
export const DarkScheme = meta.story({
  globals: { theme: 'dark' },
  render: () => inventory('color', 'text-ink'),
});

/** The quiet inventory in the dark scheme, proving the tertiary ink reads on a dark sheet. */
export const MonoDarkScheme = meta.story({
  globals: { theme: 'dark' },
  render: () => inventory('mono', 'text-ink-tertiary'),
});
