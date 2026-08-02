import { RouterContextProvider } from '@tanstack/react-router';
import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { AddProviderAct } from '../../pages/providers';
import { hideSidebar, showSidebar } from '../../shared/lib';
import { gatewaySeed, paintedBox, paintedStyle } from '../../shared/testing';
import { SidebarToggle } from '../../shared/ui';
import { createQueryClient } from '../query-client';
import { createAppRouter } from '../router';
import { AppSidebar } from './-app-sidebar';
import { AppToolbar } from './-app-toolbar';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });

const meta = preview.meta({
  beforeEach: () => {
    showSidebar();
  },
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
 * It holds the same height as a gateway's toolbar, so an act it carries breathes instead of
 * hugging the window's edge and the shell reads as one bar everywhere.
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

/**
 * The same surface once the sidebar has gone, where the region becomes a bar of its own.
 *
 * @summary It takes the toolbar's surface and hairline so that the control it now carries stands
 * on something, and so that scrolled content passes under a bar rather than under a control
 * floating over the page. It holds the same height as a gateway's toolbar, and its control is
 * the same raised button that toolbar carries, so the shell reads as one bar everywhere. It
 * keeps its place out of the flow, so nothing below it moves.
 */
export const NoGatewaySelectedWithTheSidebarAway = meta.story({
  beforeEach: () => {
    hideSidebar();

    return () => {
      showSidebar();
    };
  },
  play: async ({ canvas, canvasElement }) => {
    const toggle = await canvas.findByRole('button', { name: 'Sidebar' });

    const region = canvasElement.firstElementChild?.firstElementChild;
    const painted = paintedStyle(region);

    await expect(painted.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    await expect(painted.borderBottomWidth).toBe('1px');
    await expect(painted.position).toBe('absolute');
    await expect(paintedBox(region).height).toBe(54);
    await expect(paintedStyle(toggle).borderTopWidth).toBe('1px');
    await expect(paintedBox(toggle).height).toBe(29);
  },
});

/**
 * The strip over a providers screen, carrying the one act at its trailing edge.
 *
 * @summary The act stands where macOS keeps a window's own acts, so the reading measures the
 * control against the strip's end rather than trusting the markup order.
 */
export const ProvidersActAtTheTrailingEdge = meta.story({
  args: { trailing: <AddProviderAct kind="subscription" /> },
  play: async ({ canvas, canvasElement }) => {
    const control = await canvas.findByRole('button', { name: 'Add provider' });
    const strip = paintedBox(canvasElement.firstElementChild?.firstElementChild);
    const act = paintedBox(control);

    await expect(act.x + act.width).toBeGreaterThan(strip.x + strip.width - 40);
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
      <div className="relative flex-1 overflow-y-auto">
        <section className="absolute inset-0" />
      </div>
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
 * carries, which pushes the first group heading below where the rest of the shell expects it. The
 * band is where the control that puts the sidebar away stands, on the centre the controls take.
 */
export const SidebarClearsTheWindowControls = meta.story({
  parameters: { bridge: { engineStates: {}, gateways: [codex] } },
  render: () => (
    <RouterContextProvider router={createAppRouter({ queryClient: createQueryClient() })}>
      <AppSidebar away={false} onNewGateway={() => undefined} />
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
 * The control in the sidebar's band, drawn to the centre macOS gives its own controls.
 *
 * @summary The window controls sit centred in a thirty-six pixel band, so anything sharing that
 * band and drawn to another centre reads as a mistake. The control also stands clear of the
 * corner they occupy, at the trailing edge, where nothing it could collide with is drawn.
 */
export const SidebarControlTakesTheWindowControlCentre = meta.story({
  parameters: { bridge: { engineStates: {}, gateways: [codex] } },
  render: () => (
    <RouterContextProvider router={createAppRouter({ queryClient: createQueryClient() })}>
      <AppSidebar
        away={false}
        band={<SidebarToggle where="chrome" />}
        onNewGateway={() => undefined}
      />
    </RouterContextProvider>
  ),
  play: async ({ canvas, canvasElement }) => {
    const toggle = await canvas.findByRole('button', { name: 'Sidebar' });
    const sidebar = canvasElement.firstElementChild?.firstElementChild;
    const drawn = paintedBox(toggle);
    const band = paintedBox(sidebar);

    await expect((drawn.top + drawn.bottom) / 2 - band.top).toBe(18);
    const cleared = getComputedStyle(document.documentElement).getPropertyValue(
      '--spacing-window-controls-width',
    );

    await expect(drawn.left - band.left).toBeGreaterThan(Number.parseInt(cleared, 10));
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
    <div className="relative flex-1 overflow-y-auto">
      <p className="p-4 text-body text-ink-secondary">The route paints here.</p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const surface = canvasElement.firstElementChild?.firstElementChild;

    await expect(paintedStyle(surface).backgroundImage).toBe('none');
  },
});
