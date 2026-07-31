import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { SidebarToggle } from './sidebar-toggle';

const meta = preview.meta({ component: SidebarToggle });

/**
 * The control that puts the sidebar away, which reports the state it is about to leave.
 *
 * @summary A screen reader hears whether the sidebar stands before deciding to press, rather
 * than pressing to find out. The control keeps one name in both states, so the thing it acts on
 * stays the same thing.
 */
export const SidebarPutsItselfAway = meta.story({
  render: () => <SidebarToggle />,
  play: async ({ canvas, userEvent }) => {
    const toggle = await canvas.findByRole('button', { name: 'Sidebar' });

    await expect(toggle.getAttribute('aria-expanded')).toBe('true');

    await userEvent.click(toggle);

    await expect(toggle.getAttribute('aria-expanded')).toBe('false');

    await userEvent.click(toggle);

    await expect(toggle.getAttribute('aria-expanded')).toBe('true');
  },
});
