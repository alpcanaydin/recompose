import { expect } from 'storybook/test';

import preview from '#.storybook/preview';
import { inSettingsColumn } from '#.storybook/settings-column';

import { ServerSection } from './server-section';

const meta = preview.meta({
  component: ServerSection,
  decorators: [inSettingsColumn],
});

/** The port a person can set, beside the two rows still waiting on the engine. */
export const Basic = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('textbox', { name: 'Port' })).toHaveValue('8397');
    await expect(await canvas.findByRole('textbox', { name: 'Bind address' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
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
