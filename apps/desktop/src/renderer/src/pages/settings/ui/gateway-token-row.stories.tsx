import type { GatewayTokenStatus } from '@recompose/contracts';

import { expect, waitFor } from 'storybook/test';

import preview from '#.storybook/preview';
import { inFieldGroup, inSettingsColumn } from '#.storybook/settings-column';

import { GatewayTokenRow } from './gateway-token-row';

function holding(masked: string | null, storage: GatewayTokenStatus['storage'] = 'available') {
  return {
    bridge: {
      overrides: {
        'gateway-token:status': async () =>
          Promise.resolve({ ok: true, value: { masked, storage } }),
        'gateway-token:mint': async () =>
          Promise.resolve({ ok: true, value: { masked: 'rc-local-••••••••f4c1', storage } }),
        'gateway-token:copy': async () => Promise.resolve({ ok: true, value: undefined }),
      },
    },
  };
}

const meta = preview.meta({
  component: GatewayTokenRow,
  decorators: [inFieldGroup('Server'), inSettingsColumn],
});

/** The requirement is on but nothing has been minted yet, so the row offers to mint. */
export const NothingMinted = meta.story({
  parameters: holding(null),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: 'Generate' })).toBeInTheDocument();
    await canvas.findByRole('button', { name: 'Generate' });

    await expect(canvas.queryByRole('button', { name: 'Copy' })).toBeNull();
  },
});

/** The resting state: a mask keeping the prefix and the last four, and nothing else. */
export const Masked = meta.story({
  parameters: holding('rc-local-••••••••9a3d'),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('rc-local-••••••••9a3d')).toBeInTheDocument();
    await expect(await canvas.findByRole('button', { name: 'Copy' })).toBeInTheDocument();
    await expect(await canvas.findByRole('button', { name: 'Regenerate' })).toBeInTheDocument();
  },
});

/**
 * The second phase of a regeneration, which is where the risk of this row lives.
 *
 * @summary The consequence is stated, the safe choice holds focus, and Escape backs out.
 */
export const ConfirmingRegeneration = meta.story({
  parameters: holding('rc-local-••••••••9a3d'),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Regenerate' }));

    await expect(await canvas.findByRole('alert')).toHaveTextContent(/stop connecting/i);
    const safeChoice = await canvas.findByRole('button', { name: 'Cancel' });

    await waitFor(async () => {
      await expect(safeChoice).toHaveFocus();
    });

    await userEvent.keyboard('{Escape}');

    await expect(await canvas.findByRole('button', { name: 'Copy' })).toBeInTheDocument();
  },
});

/** Copying announces itself, because the value it moved never appears on the screen. */
export const Copied = meta.story({
  parameters: holding('rc-local-••••••••9a3d'),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Copy' }));

    await expect(await canvas.findByRole('alert')).toHaveTextContent('Copied.');
  },
});

/** The same row under the dark scheme, where the destructive border has to carry its own weight. */
export const DarkScheme = meta.story({
  globals: { theme: 'dark' },
  parameters: holding('rc-local-••••••••9a3d'),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Regenerate' }));

    const safeChoice = await canvas.findByRole('button', { name: 'Cancel' });

    await waitFor(async () => {
      await expect(safeChoice).toHaveFocus();
    });
  },
});
