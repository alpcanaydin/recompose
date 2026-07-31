import { RouterContextProvider } from '@tanstack/react-router';
import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { gatewaySeed, paintedBox, paintedStyle } from '../../shared/testing';
import { createQueryClient } from '../query-client';
import { createAppRouter } from '../router';
import { AppContent, AppSidebar, AppToolbar } from './-app-shell';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });

const meta = preview.meta({
  component: AppToolbar,
  args: { slug: undefined },
  decorators: [
    (Story) => (
      <div className="relative flex h-40 flex-col bg-surface-content">
        <Story />
      </div>
    ),
  ],
});

/**
 * A surface holding no gateway, where the top of the shell is drag space and nothing else.
 *
 * @summary The window hides its own title bar, so this region is the only place left to take
 * hold of it. It carries no surface and sits out of the flow, leaving the content its full box.
 */
export const NoGatewaySelected = meta.story({
  play: async ({ canvasElement }) => {
    const box = canvasElement.firstElementChild;
    const region = box?.firstElementChild;
    const painted = paintedStyle(region);

    await expect(painted.getPropertyValue('-webkit-app-region')).toBe('drag');
    await expect(painted.position).toBe('absolute');
    await expect(painted.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    await expect(painted.borderBottomWidth).toBe('0px');

    const drawn = paintedBox(region);
    const surface = paintedBox(box);

    await expect(drawn.top).toBe(surface.top);
    await expect(drawn.width).toBe(surface.width);
    await expect(drawn.height).toBe(54);
  },
});

/** The strip over a selected gateway, which carries the toolbar surface and its hairline. */
export const GatewaySelected = meta.story({
  args: { slug: 'codex' },
  parameters: { bridge: { gateways: [codex], engineStates: {} } },
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByRole('button', { name: 'Start' });

    const strip = canvasElement.firstElementChild?.firstElementChild;

    await expect(paintedStyle(strip).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    await expect(paintedStyle(strip).borderBottomWidth).toBe('1px');
  },
});

/**
 * The top edge of a surface whose route fills the whole box, which still takes hold of the window.
 *
 * @summary A route that paints over its box would bury the drag region under itself, and the
 * window would lose the only edge it can be moved by. The grab has to reach the region first.
 */
export const TopEdgeTakesHoldOfTheWindow = meta.story({
  render: () => (
    <>
      <AppToolbar slug={undefined} />
      <AppContent>
        <section className="absolute inset-0" />
      </AppContent>
    </>
  ),
  play: async ({ canvasElement }) => {
    const box = paintedBox(canvasElement.firstElementChild);
    const grabbed = document.elementFromPoint(box.x + box.width / 2, box.y + 10);

    await expect(paintedStyle(grabbed).getPropertyValue('-webkit-app-region')).toBe('drag');
  },
});

/**
 * The sidebar's top inset, which clears the window controls instead of reserving toolbar height.
 *
 * @summary macOS draws its own controls over this corner, and clearing them is all the inset owes.
 * Borrowing the toolbar's height reserves eighteen more pixels for a toolbar the sidebar never
 * carries, which pushes the first group heading below where the rest of the shell expects it.
 */
export const SidebarClearsTheWindowControls = meta.story({
  parameters: { bridge: { engineStates: {}, gateways: [codex] } },
  render: () => (
    <RouterContextProvider router={createAppRouter({ queryClient: createQueryClient() })}>
      <AppSidebar onNewGateway={() => undefined} />
    </RouterContextProvider>
  ),
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByRole('heading', { name: 'Local Gateways' });

    const sidebar = canvasElement.firstElementChild?.firstElementChild;
    const heading = sidebar?.querySelector('h2');

    await expect(paintedBox(heading).top - paintedBox(sidebar).top).toBe(36);
  },
});

/**
 * The region every route scrolls inside, which paints no texture of its own.
 *
 * @summary The dot grid belongs to the canvas routes rather than to the shell, so a route that
 * reads as a document sits on the plain surface without having to ask to be left alone.
 */
export const ContentSurface = meta.story({
  render: () => (
    <AppContent>
      <p className="p-4 text-note text-ink-secondary">The route paints here.</p>
    </AppContent>
  ),
  play: async ({ canvasElement }) => {
    const surface = canvasElement.firstElementChild?.firstElementChild;

    await expect(paintedStyle(surface).backgroundImage).toBe('none');
  },
});
