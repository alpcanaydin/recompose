import { expect, screen } from 'storybook/test';

import preview from '#.storybook/preview';

import { gatewaySeed } from '../../../../shared/testing';
import { CreateGatewaySheet } from './create-gateway-sheet';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });

const meta = preview.meta({
  component: CreateGatewaySheet,
  args: { open: true, onOpenChange: () => {} },
});

/** The sheet as it arrives: three empty fields, a free port already filled, a live preview. */
export const Open = meta.story({
  play: async () => {
    const sheet = await screen.findByRole('dialog', { name: 'Create a gateway' });

    await expect(sheet).toHaveAccessibleDescription('Name it and pick the port it serves on.');
    await expect(await screen.findByRole('textbox', { name: 'Port' })).toHaveValue('51234');
    await expect(sheet).toHaveTextContent('Serves at');
    await expect(sheet).toHaveTextContent('http://localhost:51234');
  },
});

/** The offer routes around a port a stored gateway already holds. */
export const PortAroundAStoredGateway = meta.story({
  parameters: { bridge: { gateways: [codex] } },
  play: async () => {
    await expect(await screen.findByRole('textbox', { name: 'Port' })).toHaveValue('51235');
  },
});
