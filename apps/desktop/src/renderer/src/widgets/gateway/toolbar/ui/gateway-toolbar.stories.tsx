import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { gatewaySeed } from '../../../../shared/testing';
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
