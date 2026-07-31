import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { gatewaySeed, paintedBox, paintedStyle } from '../../../../shared/testing';
import { GatewaySidebar } from './gateway-sidebar';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });
const gemini = gatewaySeed({ slug: 'gemini', displayName: 'Gemini', port: 51235 });

const meta = preview.meta({
  component: GatewaySidebar,
  args: { onNewGateway: () => {} },
  decorators: [
    (Story) => (
      <aside className="w-60 bg-surface-sidebar p-2.5 text-body text-ink-secondary">
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

/** The row rhythm the reference fixes, which the shell repeats for every group it holds. */
export const RowRhythm = meta.story({
  parameters: { bridge: { gateways: [codex] } },
  play: async ({ canvas }) => {
    const heading = await canvas.findByRole('heading', { name: 'Local Gateways' });
    const row = await canvas.findByRole('link', { name: 'Codex Stopped' });
    const next = await canvas.findByRole('button', { name: 'New Gateway…' });
    const mark = await canvas.findByRole('img', { name: 'Stopped' });

    await expect(paintedStyle(heading).fontSize).toBe('11px');
    await expect(paintedStyle(heading).fontWeight).toBe('600');
    await expect(paintedStyle(heading).padding).toBe('14px 8px 3px');

    await expect(paintedBox(row).height).toBe(28);
    await expect(paintedStyle(row).borderRadius).toBe('6px');
    await expect(paintedStyle(row).paddingLeft).toBe('8px');
    await expect(paintedStyle(row).fontSize).toBe('13px');
    await expect(paintedStyle(row).columnGap).toBe('7px');
    await expect(paintedBox(row.querySelector('svg')).width).toBe(16);

    await expect(paintedBox(mark).width).toBe(6);
    await expect(paintedBox(mark).right).toBeCloseTo(paintedBox(row).right - 8, 0);

    await expect(paintedStyle(next).fontWeight).toBe('500');
    await expect(paintedBox(next.querySelector('svg')).width).toBe(14);
  },
});
