import { expect } from 'storybook/test';

import preview from '#.storybook/preview';
import { withSidebarSurface } from '#.storybook/sidebar-surface';

import { gatewaySeed, paintedBox, paintedStyle } from '../../../../shared/testing';
import { GatewaySidebar } from './gateway-sidebar';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });
const gemini = gatewaySeed({ slug: 'gemini', displayName: 'Gemini', port: 51235 });

const meta = preview.meta({
  component: GatewaySidebar,
  args: { onNewGateway: () => {} },
  decorators: [withSidebarSurface],
});

/** Two gateways where only one serves, so the pair of marks stands side by side. */
export const MixedStates = meta.story({
  parameters: {
    bridge: {
      gateways: [codex, gemini],
      engineStates: { codex: { status: 'running' } },
    },
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('link', { name: 'Codex Running' })).toBeVisible();
    await expect(await canvas.findByRole('link', { name: 'Gemini Stopped' })).toBeVisible();
  },
});

/**
 * The way to a second gateway, drawn as a mark on the heading once the list has members.
 *
 * @summary A row under a list reads as a member of that list, so the act moves onto the heading
 * the way a macOS source list does. Its name does not change with its shape.
 */
export const NewGatewayMarkOnTheHeading = meta.story({
  parameters: { bridge: { gateways: [codex] } },
  play: async ({ canvas }) => {
    const next = await canvas.findByRole('button', { name: 'New Gateway…' });
    const heading = await canvas.findByRole('heading', { name: 'Local Gateways' });

    await expect(next).toHaveTextContent('');
    await expect(paintedBox(next).top).toBeGreaterThanOrEqual(paintedBox(heading).top);
    await expect(paintedBox(next).bottom).toBeLessThanOrEqual(paintedBox(heading).bottom);
    await expect(paintedBox(next).left).toBeGreaterThan(paintedBox(heading).left);
  },
});

/**
 * The plus and the state marks under it standing on one vertical line.
 *
 * @summary They are the only ink in that column, so a ragged trailing edge reads immediately.
 * The mark is a filled shape that reaches its own box edge, while the plus is a stroked path
 * that stops short of one, so aligning the boxes leaves the ink ragged. The button carries the
 * difference, and this holds the two inks on one line rather than the two boxes.
 */
export const TrailingEdgeHoldsOneLine = meta.story({
  parameters: { bridge: { gateways: [codex] } },
  play: async ({ canvas }) => {
    const next = await canvas.findByRole('button', { name: 'New Gateway…' });
    const mark = await canvas.findByRole('img', { name: 'Stopped' });

    const gap = paintedBox(next.querySelector('svg path')).right - paintedBox(mark).right;

    await expect(Math.abs(gap)).toBeLessThan(0.5);
  },
});

/**
 * A fresh install, where the group stands with its heading and nothing listed under it.
 *
 * @summary The heading and the way to the first gateway show before any gateway exists, so the
 * sidebar says where gateways will land rather than leaving a gap until one saves.
 */
export const NoGatewayYet = meta.story({
  parameters: { bridge: { gateways: [] } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: 'Local Gateways' })).toBeVisible();

    const next = await canvas.findByRole('button', { name: 'New Gateway…' });

    await expect(canvas.queryAllByRole('link')).toHaveLength(0);
    await expect(next).toHaveTextContent('New Gateway…');
    await expect(paintedStyle(next).fontWeight).toBe('500');
    await expect(paintedBox(next.querySelector('svg')).width).toBe(14);
  },
});

/** The row rhythm the reference fixes, which the shell repeats for every group it holds. */
export const RowRhythm = meta.story({
  parameters: { bridge: { gateways: [codex] } },
  play: async ({ canvas }) => {
    const heading = await canvas.findByRole('heading', { name: 'Local Gateways' });
    const row = await canvas.findByRole('link', { name: 'Codex Stopped' });
    const mark = await canvas.findByRole('img', { name: 'Stopped' });

    await expect(paintedStyle(heading).fontSize).toBe('11px');
    await expect(paintedStyle(heading).fontWeight).toBe('600');
    await expect(paintedStyle(heading).padding).toBe('14px 8px 3px');

    await expect(paintedBox(row).height).toBe(28);
    await expect(paintedStyle(row).borderRadius).toBe('6px');
    await expect(paintedStyle(row).paddingLeft).toBe('8px');
    await expect(paintedStyle(row).fontSize).toBe('13px');
    await expect(paintedStyle(row).columnGap).toBe('7px');
    await expect(paintedBox(row.querySelector('svg')).width).toBe(16);

    await expect(paintedBox(mark).width).toBe(6);
    await expect(paintedBox(mark).right).toBeCloseTo(paintedBox(row).right - 8, 0);
  },
});
