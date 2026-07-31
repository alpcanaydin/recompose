import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { paintedBox, paintedStyle } from '../../../shared/testing';
import { EmptyState } from './empty-state';

const meta = preview.meta({
  component: EmptyState,
  args: { onCreateGateway: () => {} },
});

/** The invitation a fresh install meets, carrying the one act worth taking on it. */
export const Basic = meta.story({
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { name: 'Create your first gateway', level: 1 }),
    ).toBeVisible();
    await expect(await canvas.findByRole('button', { name: 'Create Gateway' })).toBeVisible();
    await expect(await canvas.findByRole('link', { name: 'Read the guide' })).toBeVisible();
  },
});

/** The uneven rhythm the reference fixes, which one even gap would flatten. */
export const Rhythm = meta.story({
  play: async ({ canvas, canvasElement }) => {
    const heading = await canvas.findByRole('heading', { level: 1 });
    const ghost = canvasElement.querySelector('svg');
    const body = await canvas.findByText(/A gateway is one local address/);
    const hint = await canvas.findByText('or press ⌘ N');

    await expect(paintedBox(ghost).width).toBe(436);
    await expect(paintedBox(ghost).height).toBe(96);
    await expect(paintedStyle(ghost).opacity).toBe('0.75');
    await expect(paintedStyle(ghost).marginBottom).toBe('26px');

    await expect(paintedStyle(heading).fontSize).toBe('17px');
    await expect(paintedStyle(heading).fontWeight).toBe('600');
    await expect(paintedStyle(heading).letterSpacing).toBe('-0.3px');
    await expect(paintedStyle(heading).marginBottom).toBe('6px');

    await expect(paintedStyle(body).fontSize).toBe('12.5px');
    await expect(paintedStyle(body).maxWidth).toBe('410px');
    await expect(paintedStyle(body).lineHeight).toBe('18.75px');
    await expect(paintedStyle(body).marginBottom).toBe('18px');

    await expect(paintedStyle(hint).fontSize).toBe('11px');
    await expect(paintedStyle(hint).marginTop).toBe('14px');
  },
});

/** The two controls the reference sets side by side, at the size it draws them. */
export const CallToAction = meta.story({
  play: async ({ canvas }) => {
    const create = await canvas.findByRole('button', { name: 'Create Gateway' });
    const guide = await canvas.findByRole('link', { name: 'Read the guide' });

    await expect(paintedStyle(create.parentElement).columnGap).toBe('10px');

    for (const control of [create, guide]) {
      await expect(paintedBox(control).height).toBe(28);
      await expect(paintedStyle(control).paddingLeft).toBe('13px');
      await expect(paintedStyle(control).borderRadius).toBe('6px');
      await expect(paintedStyle(control).fontSize).toBe('12.5px');
      await expect(paintedStyle(control).fontWeight).toBe('500');
      await expect(paintedStyle(control).columnGap).toBe('6px');
      await expect(paintedBox(control.querySelector('svg')).width).toBe(15);
    }

    await expect(paintedStyle(create).borderTopWidth).toBe('1px');
    await expect(paintedStyle(create).borderTopColor).toBe('rgba(0, 0, 0, 0)');
    await expect(paintedStyle(guide).borderTopColor).not.toBe('rgba(0, 0, 0, 0)');
  },
});
