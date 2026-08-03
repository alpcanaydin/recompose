import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { showSidebar } from '../../lib/sidebar-visibility';
import { SidebarToggle } from './sidebar-toggle';

const meta = preview.meta({
  beforeEach: () => {
    showSidebar();
  },
  component: SidebarToggle,
});

/**
 * The control that puts the sidebar away, which reports the state it is about to leave.
 *
 * @summary A screen reader hears whether the sidebar stands before deciding to press, rather
 * than pressing to find out. The control keeps one name in both states, so the thing it acts on
 * stays the same thing.
 */
export const SidebarPutsItselfAway = meta.story({
  render: () => <SidebarToggle where="standing" />,
  play: async ({ canvas, userEvent }) => {
    const toggle = await canvas.findByRole('button', { name: 'Sidebar' });

    await expect(toggle.getAttribute('aria-expanded')).toBe('true');

    await userEvent.click(toggle);

    await expect(toggle.getAttribute('aria-expanded')).toBe('false');

    await userEvent.click(toggle);

    await expect(toggle.getAttribute('aria-expanded')).toBe('true');
  },
});

/**
 * The same control in the sidebar's own band, drawn flat instead of raised.
 *
 * @summary Beside the window controls a raised button reads as a stray member of the toolbar
 * across the divider, which sits on a different centre. Flat, it reads as window chrome, which
 * is what it is there.
 */
export const InTheSidebarBand = meta.story({
  render: () => <SidebarToggle where="chrome" />,
  play: async ({ canvas }) => {
    const toggle = await canvas.findByRole('button', { name: 'Sidebar' });
    const painted = getComputedStyle(toggle);

    await expect(painted.borderTopWidth).toBe('0px');
    await expect(painted.backgroundColor).toBe('rgba(0, 0, 0, 0)');
  },
});
