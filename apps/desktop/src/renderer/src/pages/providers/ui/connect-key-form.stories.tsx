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

/**
 * The two things the catalog can't already know, over the host the key will reach.
 *
 * @summary The provider rode in from the picked entry, so the form never asks it again, and a base
 * URL or a dialect would ask for what this provider settles. The reading counts what the form asks
 * for and looks for the host, because a person hands over a secret only once they know its address.
 */
export const AsksOnlyWhatIsUnknown = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByLabelText('Name')).toBeVisible();
    await expect(await canvas.findByLabelText('Key')).toBeVisible();
    await expect(await canvas.findByText('api.anthropic.com')).toBeVisible();
    await expect(canvas.queryByLabelText('Provider')).toBeNull();
    await expect(canvas.queryByLabelText('Base URL')).toBeNull();
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

/**
 * A named key, whose Connect stands ready once the name that tells it apart exists.
 *
 * @summary Two keys under one provider differ by purpose, and the name carries the purpose, so
 * Connect waits for it. The reading fills the name and reads the control, because an act that
 * stays out of reach with nothing said about why reads as a broken one.
 */
export const NamedAndReady = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: 'Connect' })).toBeDisabled();

    await userEvent.type(await canvas.findByLabelText('Name'), 'build');

    await expect(await canvas.findByRole('button', { name: 'Connect' })).toBeEnabled();
  },
});

/**
 * A key whose opening belongs to the other vendor, warned about rather than turned away.
 *
 * @summary Vendors mint new key families without notice, and a shape gate has already turned away
 * legitimate keys elsewhere, so the form says what it noticed and lets the connect stand. The
 * reading looks for the warning beside a live Connect, because a warning that blocks is a refusal.
 */
export const ForeignShapeWarns = meta.story({
  args: { provider: 'openai' as const },
  play: async ({ canvas }) => {
    await userEvent.type(await canvas.findByLabelText('Name'), 'build');
    await userEvent.type(await canvas.findByLabelText('Key'), 'sk-ant-api03-supersecret');

    await expect(await canvas.findByRole('status')).toHaveTextContent('Anthropic');
    await expect(await canvas.findByRole('button', { name: 'Connect' })).toBeEnabled();
  },
});

/** The same form in the dark scheme, where the field ink sits on the raised surface instead. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
