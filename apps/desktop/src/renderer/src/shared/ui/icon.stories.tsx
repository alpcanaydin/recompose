import { expect, within } from 'storybook/test';

import preview from '#.storybook/preview';

import { type IconName, Icon } from './index';

const sprite: IconName[] = ['plus', 'book', 'check', 'network', 'spark', 'person', 'gauge', 'gear'];

const meta = preview.meta({
  component: Icon,
  args: { name: 'plus' },
});

/** Every glyph the sprite carries, which is every glyph this build draws. */
export const Sprite = meta.story({
  render: () => (
    <ul className="flex list-none gap-4 p-0">
      {sprite.map((name) => (
        <li className="text-ink" key={name}>
          <Icon name={name} />
        </li>
      ))}
    </ul>
  ),
  play: async ({ canvasElement }) => {
    const drawn = canvasElement.querySelectorAll('svg');

    await expect(drawn).toHaveLength(sprite.length);

    for (const glyph of drawn) {
      await expect(glyph.getBoundingClientRect().width).toBe(16);
      await expect(glyph).toHaveAttribute('aria-hidden');
    }
  },
});

/** The glyph a button carries, which the reference draws a pixel smaller than the standing size. */
export const InAButton = meta.story({
  render: () => (
    <button className="push-button-primary" type="button">
      <Icon className="size-3.75" name="plus" />
      Create Gateway
    </button>
  ),
  play: async ({ canvasElement }) => {
    const pressed = await within(canvasElement).findByRole('button', { name: 'Create Gateway' });
    const glyph = pressed.querySelector('svg');

    await expect(glyph?.getBoundingClientRect().width).toBe(15);
    await expect(getComputedStyle(pressed).columnGap).toBe('6px');
  },
});
