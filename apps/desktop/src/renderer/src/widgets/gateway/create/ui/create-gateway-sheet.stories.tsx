import { expect, screen } from 'storybook/test';

import preview from '#.storybook/preview';

import { gatewaySeed, paintedBox, paintedStyle } from '../../../../shared/testing';
import { CreateGatewaySheet } from './create-gateway-sheet';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });

const meta = preview.meta({
  component: CreateGatewaySheet,
  args: { open: true, onOpenChange: () => {}, onCreated: () => {} },
});

/** The sheet as it arrives: an empty name, a free port already filled, a live preview. */
export const Open = meta.story({
  play: async () => {
    const sheet = await screen.findByRole('dialog', { name: 'Create a gateway' });

    await expect(sheet).toHaveAccessibleDescription('Name it and pick the port it serves on.');
    await expect(await screen.findByRole('textbox', { name: 'Port' })).toHaveValue('51234');
    await expect(sheet).toHaveTextContent('Serves at');
    await expect(sheet).toHaveTextContent('http://localhost:51234');
  },
});

/** The bands the reference divides the sheet into, and the width it fixes for each of them. */
export const SheetBands = meta.story({
  play: async () => {
    const sheet = await screen.findByRole('dialog', { name: 'Create a gateway' });
    const title = await screen.findByText('Create a gateway');
    const description = await screen.findByText(/Name it and pick/);
    const actions = (await screen.findByRole('button', { name: 'Cancel' })).parentElement;

    await expect(paintedBox(sheet).width).toBe(404);
    await expect(paintedStyle(sheet).borderRadius).toBe('13px');

    await expect(paintedStyle(title.parentElement).padding).toBe('18px 18px 13px');
    await expect(paintedStyle(title).fontSize).toBe('16px');
    await expect(paintedStyle(title).fontWeight).toBe('700');
    await expect(paintedStyle(title).letterSpacing).toBe('-0.2px');

    await expect(paintedStyle(description).fontSize).toBe('12px');
    await expect(paintedStyle(description).lineHeight).toBe('18px');
    await expect(paintedStyle(description).marginTop).toBe('5px');

    await expect(paintedStyle(actions).padding).toBe('12px 18px');
    await expect(paintedStyle(actions).columnGap).toBe('8px');
    await expect(paintedStyle(actions).borderTopWidth).toBe('1px');
  },
});

/** The one grouped box the two fields sit in, rather than two stacked labelled fields. */
export const GroupedFields = meta.story({
  play: async () => {
    const name = await screen.findByRole('textbox', { name: 'Name' });
    const port = await screen.findByRole('textbox', { name: 'Port' });
    const row = name.closest('div');
    const box = row?.parentElement;

    await expect(paintedStyle(box).borderRadius).toBe('9px');
    await expect(paintedStyle(row).minHeight).toBe('38px');
    await expect(paintedStyle(row).padding).toBe('5px 12px');
    await expect(paintedStyle(row).borderBottomWidth).toBe('1px');
    await expect(paintedStyle(port.closest('div')).borderBottomWidth).toBe('0px');

    await expect(paintedBox(name).width).toBe(170);
    await expect(paintedBox(port).width).toBe(74);
    await expect(paintedStyle(port).textAlign).toBe('end');
    await expect(paintedStyle(port).fontFamily).toContain('Mono');
    await expect(paintedStyle(name).fontFamily).not.toContain('Mono');
  },
});

/** The address the sheet composes as it is typed into, reading under the box that feeds it. */
export const AddressPreview = meta.story({
  play: async () => {
    const preview = (await screen.findByText('Serves at')).parentElement;

    await expect(paintedStyle(preview).marginTop).toBe('10px');
    await expect(paintedStyle(preview).fontSize).toBe('11.5px');
    await expect(paintedStyle(preview).fontFamily).toContain('Mono');
    await expect(paintedStyle(preview).columnGap).toBe('7px');
    await expect(paintedBox(preview?.querySelector('span')).width).toBe(7);
  },
});

/** A refused name, which keeps the sheet open and says what refused it under the field. */
export const NameRefused = meta.story({
  play: async ({ userEvent }) => {
    await userEvent.type(await screen.findByRole('textbox', { name: 'Name' }), 'Con');
    await userEvent.click(await screen.findByRole('button', { name: 'Create Gateway' }));

    const refusal = await screen.findByRole('alert');
    const name = await screen.findByRole('textbox', { name: 'Name' });

    await expect(refusal).toHaveTextContent('Windows reserves this name.');
    await expect(paintedBox(refusal).top).toBeGreaterThanOrEqual(paintedBox(name).bottom);
  },
});

/** The offer routes around a port a stored gateway already holds. */
export const PortAroundAStoredGateway = meta.story({
  parameters: { bridge: { gateways: [codex] } },
  play: async () => {
    await expect(await screen.findByRole('textbox', { name: 'Port' })).toHaveValue('51235');
  },
});
