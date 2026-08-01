import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { showSidebar, sidebarHidden } from '../lib/sidebar-visibility';
import { SidebarEdge } from './sidebar-edge';

const meta = preview.meta({
  beforeEach: () => {
    showSidebar();

    return () => {
      showSidebar();
    };
  },
  component: SidebarEdge,
  decorators: [
    (Story) => (
      <div className="flex h-40 bg-surface-content">
        <Story />
      </div>
    ),
  ],
});

type PointerStep = {
  coords?: { clientX: number; clientY: number };
  keys?: string;
  target?: Element;
};

type Drags = {
  pointer: (steps: PointerStep[]) => Promise<void>;
};

type Finds = {
  findByRole: (role: string, options?: { name: string }) => Promise<HTMLElement>;
};

/** Finds the edge and drags it by the distance given, positive being away from the sidebar. */
async function dragTheEdge(canvas: Finds, userEvent: Drags, travel: number): Promise<void> {
  const edge = await canvas.findByRole('separator', { name: 'Sidebar edge' });

  await dragBy(edge, userEvent, travel);
}

/** Drags the edge from its own middle by the distance given, positive being away from the sidebar. */
async function dragBy(edge: HTMLElement, userEvent: Drags, travel: number): Promise<void> {
  const box = edge.getBoundingClientRect();
  const from = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };

  await userEvent.pointer([
    { keys: '[MouseLeft>]', target: edge, coords: from },
    { coords: { clientX: from.clientX + travel, clientY: from.clientY } },
    { keys: '[/MouseLeft]' },
  ]);
}

/**
 * The edge dragged towards the sidebar, which is the gesture that puts the sidebar away.
 *
 * @summary The direction carries the meaning, so nothing has to be aimed at. The gesture reads
 * the same whether the sidebar stands or has gone, because the edge travels with it.
 */
export const DragTowardsTheSidebar = meta.story({
  play: async ({ canvas, userEvent }) => {
    await dragTheEdge(canvas, userEvent, -90);

    await expect(sidebarHidden()).toBe(true);
  },
});

/** The same edge dragged out from the sidebar, which brings it back. */
export const DragAwayFromTheSidebar = meta.story({
  play: async ({ canvas, userEvent }) => {
    await dragTheEdge(canvas, userEvent, -90);
    await dragTheEdge(canvas, userEvent, 90);

    await expect(sidebarHidden()).toBe(false);
  },
});

/**
 * A nudge too small to mean anything, which leaves the sidebar where it stands.
 *
 * @summary A pointer wanders a few pixels while a person presses, so a gesture that acts on the
 * first pixel of travel would flip the sidebar every time somebody grazed the edge.
 */
export const NudgeTooSmallToMeanAnything = meta.story({
  play: async ({ canvas, userEvent }) => {
    await dragTheEdge(canvas, userEvent, -12);

    await expect(sidebarHidden()).toBe(false);
  },
});

/** The edge under the pointer, which reports that it is the thing you drag. */
export const EdgeShowsTheResizeCursor = meta.story({
  play: async ({ canvas }) => {
    const edge = await canvas.findByRole('separator', { name: 'Sidebar edge' });

    await expect(getComputedStyle(edge).cursor).toBe('ew-resize');
  },
});
