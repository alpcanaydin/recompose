import type { ReactNode } from 'react';

import { useSyncExternalStore } from 'react';
import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import {
  panelBounds,
  panelWidth,
  setPanelWidth,
  showSidebar,
  sidebarHidden,
  subscribeToPanelWidths,
  subscribeToSidebarVisibility,
} from '../../lib';
import { paintedStyle, pressedByKeyboard } from '../../testing';
import { SidebarEdge } from './sidebar-edge';

const bounds = panelBounds.sidebar;

function SidebarBeside({ children }: { children: ReactNode }) {
  const width = useSyncExternalStore(subscribeToPanelWidths, () => panelWidth('sidebar'));
  const away = useSyncExternalStore(subscribeToSidebarVisibility, sidebarHidden);

  return (
    <div className="flex h-40 bg-surface-content">
      <aside
        className="shrink-0 overflow-hidden border-e border-line-subtle bg-surface-sidebar p-3"
        style={{ width: away ? 0 : width }}
      >
        <p className="text-caption font-bold text-ink-secondary">Sidebar</p>
      </aside>
      {children}
      <div className="flex-1" />
    </div>
  );
}

const meta = preview.meta({
  beforeEach: () => {
    showSidebar();
    setPanelWidth('sidebar', bounds.standing);

    return () => {
      showSidebar();
      setPanelWidth('sidebar', bounds.standing);
    };
  },
  component: SidebarEdge,
  decorators: [
    (Story) => (
      <SidebarBeside>
        <Story />
      </SidebarBeside>
    ),
  ],
});

const theEdge = { role: 'separator', name: 'Sidebar width' };

/**
 * The edge at the sidebar's standing width, which is where a person meets it.
 *
 * @summary The edge is the sidebar's own border rather than a control parked beside it, and it
 * carries the resize cursor so a person learns it can be dragged before they try.
 */
export const Standing = meta.story({
  play: async ({ canvas }) => {
    const edge = await canvas.findByRole('separator', { name: theEdge.name });

    await expect(paintedStyle(edge).cursor).toBe('ew-resize');
    await expect(edge).toHaveAttribute('aria-orientation', 'vertical');
    await expect(edge).toHaveAttribute('aria-valuenow', String(bounds.standing));
  },
});

/** The edge sizing the sidebar from the keyboard, one step per press. */
export const SizedByKeyboard = meta.story({
  play: async ({ canvas, userEvent }) => {
    const edge = await pressedByKeyboard(canvas, theEdge, userEvent.keyboard, '{ArrowRight}');

    await expect(edge).toHaveAttribute('aria-valuenow', String(bounds.standing + bounds.step));
  },
});

/** The edge reaching the widest the sidebar may stand, where the pattern says End goes. */
export const Widest = meta.story({
  play: async ({ canvas, userEvent }) => {
    const edge = await pressedByKeyboard(canvas, theEdge, userEvent.keyboard, '{End}');

    await expect(edge).toHaveAttribute('aria-valuenow', String(bounds.max));
  },
});

/**
 * The edge once the sidebar has gone, waiting at the window's leading edge for the way back.
 *
 * @summary The sidebar takes no room, so this border is all that is left of it, and it has to keep
 * standing rather than leaving with the panel. A strip announcing a width against a sidebar of none
 * would be worse than no strip at all.
 */
export const SidebarShut = meta.story({
  play: async ({ canvas, userEvent }) => {
    const edge = await pressedByKeyboard(canvas, theEdge, userEvent.keyboard, '{Enter}');

    await expect(edge).toHaveAttribute('aria-valuenow', '0');
    await expect(paintedStyle(edge).cursor).toBe('ew-resize');
  },
});

/**
 * The sidebar brought back out of shut, at the width its owner had chosen.
 *
 * @summary The gesture that put the sidebar away is the one that returns it, and the width it stood
 * at outlives the collapse, so nobody loses a sizing by closing the panel they had just sized.
 */
export const SidebarBroughtBack = meta.story({
  play: async ({ canvas, userEvent }) => {
    const edge = await pressedByKeyboard(canvas, theEdge, userEvent.keyboard, '{End}');

    await userEvent.keyboard('{Enter}');
    await expect(edge).toHaveAttribute('aria-valuenow', '0');

    await userEvent.keyboard('{ArrowRight}');

    await expect(edge).toHaveAttribute('aria-valuenow', String(bounds.max));
  },
});

/** The edge in the dark scheme, where the border it sits on has to stay findable. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
