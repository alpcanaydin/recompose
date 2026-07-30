import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { gatewaySeed } from '../../../../shared/testing';
import { GatewaySidebar } from './gateway-sidebar';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });
const gemini = gatewaySeed({ slug: 'gemini', displayName: 'Gemini', port: 51235 });

const meta = preview.meta({
  component: GatewaySidebar,
  args: { onNewGateway: () => {} },
  decorators: [
    (Story) => (
      <aside className="w-60 bg-surface-sidebar p-4 text-body text-ink-secondary">
        <Story />
      </aside>
    ),
  ],
});

/** Two gateways where only one serves, so the pair of marks stands side by side. */
export const MixedStates = meta.story({
  parameters: {
    bridge: {
      gateways: [codex, gemini],
      engineStates: { codex: { status: 'running' } },
    },
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('link', { name: 'Codex Running' })).toBeVisible();
    await expect(await canvas.findByRole('link', { name: 'Gemini Stopped' })).toBeVisible();
  },
});

/** The way to a second gateway, which is what replaces the empty state's invitation. */
export const NewGatewayRow = meta.story({
  parameters: { bridge: { gateways: [codex] } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: 'New Gateway…' })).toBeVisible();
  },
});

/** Before the first gateway exists the group stays away, leaving the empty state to invite. */
export const NoGatewayYet = meta.story({
  parameters: { bridge: { gateways: [] } },
});
