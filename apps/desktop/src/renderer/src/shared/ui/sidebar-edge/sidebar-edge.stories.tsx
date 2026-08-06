import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { setPanelWidth } from '../../lib/panel-width';
import { showSidebar } from '../../lib/sidebar-visibility';
import { paintedStyle } from '../../testing';
import { panelBounds } from '../panel-separator/panel-resize';
import { SidebarEdge } from './sidebar-edge';
import { sidebarWidth } from './sidebar-width';

const bounds = panelBounds.sidebar;

const meta = preview.meta({
  beforeEach: () => {
    showSidebar();
    setPanelWidth('sidebar', 240);

    return () => {
      showSidebar();
      setPanelWidth('sidebar', 240);
    };
  },
  component: SidebarEdge,
  decorators: [
    (Story) => (
      <div className="flex h-40 bg-surface-content">
        <aside
          className="shrink-0 border-e border-line-subtle bg-surface-sidebar p-3"
          style={{ width: sidebarWidth() }}
        >
          <p className="text-caption font-bold text-ink-secondary">Sidebar</p>
        </aside>
        <Story />
        <div className="flex-1" />
      </div>
    ),
  ],
});

/**
 * The edge at the sidebar's standing width, which is where a person meets it.
 *
 * @summary The edge is the sidebar's own border rather than a control parked beside it, and it
 * carries the resize cursor so a person learns it can be dragged before they try.
 */
export const Standing = meta.story({
  play: async ({ canvas }) => {
    const edge = await canvas.findByRole('separator', { name: 'Sidebar width' });

    await expect(paintedStyle(edge).cursor).toBe('ew-resize');
    await expect(edge).toHaveAttribute('aria-orientation', 'vertical');
    await expect(edge).toHaveAttribute('aria-valuenow', '240');
  },
});

async function sizedByPressing(
  canvas: { findByRole: (role: string, options: { name: string }) => Promise<HTMLElement> },
  press: (keys: string) => Promise<void>,
  keys: string,
): Promise<HTMLElement> {
  const edge = await canvas.findByRole('separator', { name: 'Sidebar width' });

  edge.focus();
  await press(keys);

  return edge;
}

/** The edge sizing the sidebar from the keyboard, one step per press. */
export const SizedByKeyboard = meta.story({
  play: async ({ canvas, userEvent }) => {
    const edge = await sizedByPressing(canvas, userEvent.keyboard, '{ArrowRight}');

    await expect(edge).toHaveAttribute('aria-valuenow', String(240 + bounds.step));
  },
});

/** The edge reaching the widest the sidebar may stand, where the pattern says End goes. */
export const Widest = meta.story({
  play: async ({ canvas, userEvent }) => {
    const edge = await sizedByPressing(canvas, userEvent.keyboard, '{End}');

    await expect(edge).toHaveAttribute('aria-valuenow', String(bounds.max));
  },
});

/** The edge in the dark scheme, where the border it sits on has to stay findable. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
