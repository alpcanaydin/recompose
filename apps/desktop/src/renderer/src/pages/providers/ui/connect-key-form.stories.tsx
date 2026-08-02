import type { CredentialedAccountKind } from '@recompose/contracts';

import { expect, userEvent } from 'storybook/test';

import preview from '#.storybook/preview';
import { inSettingsColumn } from '#.storybook/settings-column';

import { ConnectKeyForm } from './connect-key-form';

const heldAs: CredentialedAccountKind = 'api-key';

const meta = preview.meta({
  component: ConnectKeyForm,
  args: { provider: 'anthropic' as const, kind: heldAs, onConnected: () => undefined },
  decorators: [inSettingsColumn],
});

/** The one thing the catalog can't already know, with everything else left off the form. */
export const AsksOnlyWhatIsUnknown = meta.story({
  play: async ({ canvas }) => {
    await expect(canvas.queryByLabelText('Provider')).toBeNull();
    await expect(canvas.queryByLabelText('Label')).toBeNull();
    await expect(await canvas.findByLabelText('Key')).toBeVisible();
  },
});

/** A key already typed, which the field masks so a shoulder or a screen share reads nothing. */
export const KeyStaysMasked = meta.story({
  play: async ({ canvas }) => {
    const key = await canvas.findByLabelText('Key');

    await userEvent.type(key, 'sk-supersecret');

    await expect(key).toHaveAttribute('type', 'password');
    await expect(canvas.queryByText('sk-supersecret')).toBeNull();
  },
});

/** The same form in the dark scheme, where the field ink sits on the raised surface instead. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
