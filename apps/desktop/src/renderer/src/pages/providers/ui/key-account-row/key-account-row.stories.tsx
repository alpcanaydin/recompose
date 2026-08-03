import type { CredentialedAccount } from '@recompose/contracts';

import { expect, screen, userEvent } from 'storybook/test';

import preview from '#.storybook/preview';

import { KeyAccountRow } from './key-account-row';

const stored: CredentialedAccount = {
  id: 'a1',
  provider: 'anthropic',
  kind: 'api-key',
  label: 'build',
  credentialRef: 'c1',
  keyTail: '7f2c',
};

const storedBeforeTheMask: CredentialedAccount = {
  id: 'a2',
  provider: 'openai',
  kind: 'api-key',
  label: 'release',
  credentialRef: 'c2',
};

const storedUnderAnUnknownProvider: CredentialedAccount = {
  id: 'a3',
  provider: 'mistral',
  kind: 'api-key',
  label: 'scratch',
  credentialRef: 'c3',
  keyTail: '19be',
};

const meta = preview.meta({
  component: KeyAccountRow,
  args: { account: stored },
  parameters: { bridge: { accounts: { schemaVersion: 4 as const, accounts: [stored] } } },
  decorators: [
    (Story) => (
      <ul className="mx-auto w-full max-w-column py-4">
        <Story />
      </ul>
    ),
  ],
});

/**
 * A stored key, reading as the product it reaches over the name and the mask.
 *
 * @summary The mask publishes four characters and no vendor prefix, because the first line already
 * names the vendor and a prefix would advertise the key class for nothing. The reading asks for
 * the product title, the name, and the mask, and nothing that resembles the secret.
 */
export const Connected = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Anthropic API')).toBeVisible();
    await expect(await canvas.findByText('build')).toBeVisible();
    await expect(await canvas.findByText('••••7f2c')).toBeVisible();
  },
});

/**
 * The answer a check leaves behind, worded as of the moment it ran.
 *
 * @summary Nothing stores this sentence, so the row never carries a claim the provider can revoke
 * without telling anyone. The reading asks for the wording rather than the verdict token, because
 * the wording is the whole promise: it speaks of one check, never of a standing.
 */
export const Checked = meta.story({
  parameters: {
    bridge: {
      accounts: { schemaVersion: 4 as const, accounts: [stored] },
      keyCheck: 'authenticates' as const,
    },
  },
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Actions for build' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Verify' }));

    await expect(await canvas.findByRole('status')).toHaveTextContent('as of this check');
  },
});

/**
 * A key stored before the mask existed, whose second line reads the name alone.
 *
 * @summary No migration can mint a tail from a secret it never reads, so the row says less rather
 * than guessing. The line stays honest until the person reconnects the key.
 */
export const StoredBeforeTheMask = meta.story({
  args: { account: storedBeforeTheMask },
  parameters: {
    bridge: { accounts: { schemaVersion: 4 as const, accounts: [storedBeforeTheMask] } },
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('release')).toBeVisible();
    await expect(canvas.queryByText(/••••/)).toBeNull();
  },
});

/**
 * A key whose provider the catalog never offered, standing with no mark and no check.
 *
 * @summary The row falls back to the provider it was stored under, because a stored row outlives
 * the catalog that made it. No probe speaks this vendor's dialect, so the row offers removal alone
 * rather than a check that could only fail.
 */
export const UnknownProvider = meta.story({
  args: { account: storedUnderAnUnknownProvider },
  parameters: {
    bridge: {
      accounts: { schemaVersion: 4 as const, accounts: [storedUnderAnUnknownProvider] },
    },
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('mistral')).toBeVisible();

    await userEvent.click(await canvas.findByRole('button', { name: 'Actions for scratch' }));

    const actions = await screen.findAllByRole('menuitem');

    await expect(actions.map((action) => action.textContent)).toEqual(['Remove']);
  },
});

/** The same key row in the dark scheme, where the mask has to hold against the raised card. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
