import type { AccountsDocument, SubscriptionAccountView } from '@recompose/contracts';

import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import type { AccountKind } from '../../../entities/account';

import { ProvidersPage } from './providers-page';

const subscriptionKind: AccountKind = 'subscription';
const keyKind: AccountKind = 'api-key';
const localKind: AccountKind = 'local';

const connected: SubscriptionAccountView = {
  id: 's1',
  provider: 'anthropic',
  label: 'Anthropic',
  signedInAs: 'dev@example.com',
  plan: 'Max',
  standing: 'connected',
  active: true,
};

const keys: AccountsDocument = {
  schemaVersion: 3,
  accounts: [
    { id: 'a2', provider: 'openai', kind: 'api-key', label: 'Work key', credentialRef: 'c2' },
  ],
};

const meta = preview.meta({
  component: ProvidersPage,
  args: { kind: subscriptionKind },
});

/**
 * The screen a person lands on before connecting anything.
 *
 * @summary The empty state is the whole screen here rather than a note above a list, because a
 * person who has connected nothing needs to know what the kind is before being offered one.
 */
export const NothingConnected = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/A subscription account is/)).toBeVisible();
  },
});

/** One connected account under the heading, read without any control of the screen's own. */
export const Connected = meta.story({
  parameters: { bridge: { subscriptions: [connected] } },
});

/** The keys destination, whose rows are targets a gateway routes to rather than plans. */
export const Keys = meta.story({
  args: { kind: keyKind },
  parameters: { bridge: { accounts: keys } },
});

/** The fourth destination, which names what will stand there rather than showing an empty list. */
export const LocalRuntimes = meta.story({ args: { kind: localKind } });

/** The connected screen in the dark scheme, where each row lifts off the screen behind it. */
export const DarkScheme = meta.story({
  globals: { theme: 'dark' },
  parameters: { bridge: { subscriptions: [connected] } },
});
