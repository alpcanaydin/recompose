import { createRef } from 'react';
import { expect, screen, waitFor } from 'storybook/test';

import preview from '#.storybook/preview';

import { GatewayDraft } from './gateway-draft';

const meta = preview.meta({
  component: GatewayDraft,
  args: {
    open: true,
    onOpenChange: () => {},
    onCreated: () => {},
    nameField: createRef<HTMLInputElement>(),
  },
});

/**
 * The standing draft: two fields, the live preview, and the pair of closing acts.
 *
 * @summary The reading asks for the dialog, both fields, and the preview line, because the draft
 * is the whole sheet and every part of it has to arrive together.
 */
export const Standing = meta.story({
  play: async () => {
    await expect(await screen.findByRole('dialog', { name: 'Create a gateway' })).toBeVisible();
    await expect(await screen.findByRole('textbox', { name: 'Name' })).toBeVisible();
    await waitFor(async () => {
      await expect(await screen.findByRole('textbox', { name: 'Port' })).not.toHaveValue('');
    });
    await expect(await screen.findByText('Serves at')).toBeVisible();
    await expect(await screen.findByRole('button', { name: 'Create Gateway' })).toBeVisible();
  },
});

/** The same draft in the dark scheme, where the sheet lifts off the scrim behind it. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
