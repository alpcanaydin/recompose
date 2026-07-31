import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { gatewaySeed, paintedStyle } from '../../../../shared/testing';
import { GatewayToolbar } from './gateway-toolbar';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });

const portTaken = {
  'engine:start': async () =>
    Promise.resolve({
      ok: true as const,
      value: { status: 'stopped' as const, failure: { port: 51234 } },
    }),
};

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
 * Every control the reference draws, in the order it draws them.
 *
 * @summary The run control leads, the address fills the middle, and the four the reference draws
 * to its right stand where it puts them. Each one comes from a single control component, so a
 * hover or a size proven here is the one every other control in the strip takes.
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

/** A start that lost its port, carrying the only recovery this build ships. */
export const StartLostThePort = meta.story({
  parameters: {
    bridge: { gateways: [codex], engineStates: {}, overrides: portTaken },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Start' }));

    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Another process holds port 51234.',
    );
    await expect(await canvas.findByRole('button', { name: 'Move to a free port' })).toBeVisible();
  },
});
