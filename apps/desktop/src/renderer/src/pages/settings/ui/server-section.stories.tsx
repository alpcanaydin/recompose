import { expect } from 'storybook/test';

import preview from '#.storybook/preview';
import { inSettingsColumn } from '#.storybook/settings-column';

import { ServerSection } from './server-section';

const meta = preview.meta({
  component: ServerSection,
  decorators: [inSettingsColumn],
});

/** The loopback address stated as a value, beside the row still waiting on launch-time start. */
export const Basic = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('127.0.0.1')).toBeVisible();
    await expect(
      await canvas.findByText('Fixed at loopback. recompose never serves the network.'),
    ).toBeVisible();
    await expect(canvas.queryByRole('textbox', { name: 'Port' })).toBeNull();
    await expect(await canvas.findByText('Waits on launch-time start.')).toBeVisible();
  },
});

/** With the requirement on, the credential row joins the group beneath it. */
export const TokenRequired = meta.story({
  parameters: {
    bridge: {
      overrides: {
        'gateway-token:status': async () =>
          Promise.resolve({
            ok: true as const,
            value: { masked: 'rc-local-••••••••9a3d', storage: 'available' as const },
          }),
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('switch', { name: 'Require API token' }));

    await expect(await canvas.findByText(/^rc-local-/u)).toBeVisible();
  },
});

/** The same group under the dark scheme. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
