import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { hideSidebar, showSidebar } from '../../../../shared/lib';
import { gatewaySeed, paintedStyle } from '../../../../shared/testing';
import { GatewayToolbar } from './gateway-toolbar';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });

const ENGINE_SILENT = 'The engine never answered.';

/** An engine that answers nothing at all, which is a refusal rather than a stopped gateway. */
function engineRefuses(act: 'engine:start' | 'engine:stop') {
  return {
    [act]: async () =>
      Promise.resolve({
        ok: false as const,
        error: { code: 'storage-failed' as const, message: ENGINE_SILENT },
      }),
  };
}

const portTaken = {
  'engine:start': async () =>
    Promise.resolve({
      ok: true as const,
      value: { status: 'stopped' as const, failure: { port: 51234 } },
    }),
};

type Finds = { findByRole: (role: string, options?: { name: string }) => Promise<HTMLElement> };
type Presses = { click: (target: Element) => Promise<unknown> };

/** Presses Start and hands back whatever line the attempt left behind. */
async function lineLeftByStarting(canvas: Finds, userEvent: Presses) {
  await userEvent.click(await canvas.findByRole('button', { name: 'Start' }));

  return canvas.findByRole('alert');
}

const meta = preview.meta({
  component: GatewayToolbar,
  args: { slug: 'codex' },
  decorators: [
    (Story) => (
      <div className="border-b border-line-subtle bg-surface-toolbar">
        <Story />
      </div>
    ),
  ],
});

/** A gateway that answers right now, so the control offers to stop it. */
export const Running = meta.story({
  parameters: {
    bridge: { gateways: [codex], engineStates: { codex: { status: 'running' } } },
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: 'Stop' })).toBeVisible();
    await expect(await canvas.findByText('Running')).toBeVisible();
  },
});

/** A gateway holding no port, where the pill still shows the address it would answer at. */
export const Stopped = meta.story({
  parameters: { bridge: { gateways: [codex], engineStates: {} } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: 'Start' })).toBeVisible();
    await expect(await canvas.findByText('localhost:51234')).toBeVisible();
  },
});

/** The strip at the height and rhythm the reference fixes, with its address pill. */
export const StripShape = meta.story({
  parameters: { bridge: { gateways: [codex], engineStates: {} } },
  play: async ({ canvas }) => {
    const strip = await canvas.findByRole('toolbar');
    const copy = await canvas.findByRole('button', { name: 'Copy address' });
    const pill = [...strip.children].find((child) => child.contains(copy));

    await expect(paintedStyle(strip).height).toBe('54px');
    await expect(paintedStyle(strip).columnGap).toBe('10px');
    await expect(paintedStyle(strip).paddingLeft).toBe('14px');

    await expect(paintedStyle(pill).height).toBe('30px');
    await expect(paintedStyle(pill).flexGrow).toBe('1');
    await expect(paintedStyle(pill).borderRadius).toBe('6px');
    await expect(paintedStyle(pill).fontSize).toBe('12.5px');
    await expect(paintedStyle(pill).fontFamily).toContain('Mono');
  },
});

/**
 * Every control the strip draws, in the order it draws them.
 *
 * @summary The sidebar control leads, the run control follows, the address fills the middle, and
 * the four drawn to its right stand where the reference puts them. A gateway surface always has a
 * toolbar, so the control lives here rather than in the sidebar's band. Each one comes from a
 * single control component, so a hover or a size proven here is the one they all take.
 */
export const EveryControl = meta.story({
  parameters: { bridge: { gateways: [codex], engineStates: {} } },
  play: async ({ canvas }) => {
    const strip = await canvas.findByRole('toolbar');
    const controls = [...strip.querySelectorAll('button')];

    await expect(controls.map((control) => control.getAttribute('aria-label'))).toEqual([
      'Sidebar',
      'Start',
      'Docs',
      'Copy address',
      'Tidy the canvas',
      'View as JSON',
      'Request log',
      'Inspector',
    ]);

    const waiting = controls.filter((control) => control.title.includes('Waits on'));

    await expect(waiting.map((control) => control.title)).toEqual([
      'Docs. Waits on the guide.',
      'Tidy the canvas. Waits on the canvas.',
      'View as JSON. Waits on the config view.',
      'Request log. Waits on request logging.',
      'Inspector. Waits on the inspector.',
    ]);
  },
});

/**
 * A start the main process refused outright, which used to change nothing on the screen.
 *
 * @summary A refused start is not a stopped gateway. The engine never answered, so the sentence
 * main wrote is the only thing that can tell a person why the button appeared to do nothing.
 */
export const StartRefused = meta.story({
  parameters: {
    bridge: {
      engineStates: {},
      gateways: [codex],
      overrides: engineRefuses('engine:start'),
    },
  },
  play: async ({ canvas, userEvent }) => {
    await expect(await lineLeftByStarting(canvas, userEvent)).toHaveTextContent(
      'The engine never answered.',
    );
  },
});

/**
 * A refusal that belongs to an action the person has already moved on from.
 *
 * @summary Three controls share one line. Each attempt clears what the last one left, so the
 * line never stacks a second sentence or reads back one belonging to an action already over.
 */
export const RefusalLeavesWithItsAction = meta.story({
  parameters: {
    bridge: {
      engineStates: { codex: { status: 'running' } },
      gateways: [codex],
      overrides: engineRefuses('engine:stop'),
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Stop' }));

    await expect(await canvas.findByRole('alert')).toHaveTextContent(ENGINE_SILENT);

    await userEvent.click(await canvas.findByRole('button', { name: 'Stop' }));

    await expect(canvas.getAllByRole('alert')).toHaveLength(1);
  },
});

/** A start that lost its port, carrying the only recovery this build ships. */
export const StartLostThePort = meta.story({
  parameters: {
    bridge: { gateways: [codex], engineStates: {}, overrides: portTaken },
  },
  play: async ({ canvas, userEvent }) => {
    await expect(await lineLeftByStarting(canvas, userEvent)).toHaveTextContent(
      'Another process holds port 51234.',
    );
    await expect(await canvas.findByRole('button', { name: 'Move to a free port' })).toBeVisible();
  },
});

/**
 * The same strip once the sidebar has gone, which stands clear of the window controls.
 *
 * @summary They move onto this row whenever the sidebar is not there to hold them, so the strip
 * takes an inset that leaves their corner alone. Nothing else about it changes.
 */
export const SidebarAwayClearsTheWindowControls = meta.story({
  parameters: { bridge: { gateways: [codex], engineStates: {} } },
  beforeEach: () => {
    hideSidebar();

    return () => {
      showSidebar();
    };
  },
  play: async ({ canvas }) => {
    const strip = await canvas.findByRole('toolbar');
    const control = await canvas.findByRole('button', { name: 'Sidebar' });
    const cleared = getComputedStyle(document.documentElement).getPropertyValue(
      '--spacing-window-controls-width',
    );

    await expect(
      `${String(control.getBoundingClientRect().left - strip.getBoundingClientRect().left)}px`,
    ).toBe(cleared.trim());
  },
});
