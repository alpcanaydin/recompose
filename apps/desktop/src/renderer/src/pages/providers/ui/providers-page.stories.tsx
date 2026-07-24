import type { AccountsDocument } from '@recompose/contracts';

import preview from '#.storybook/preview';

import { ProvidersPage } from './providers-page';

const seeded: AccountsDocument = {
  schemaVersion: 1,
  accounts: [
    {
      id: 'a1',
      provider: 'anthropic',
      kind: 'subscription',
      label: 'Claude Max',
      credentialRef: 'c1',
    },
  ],
};

const meta = preview.meta({
  component: ProvidersPage,
});

/** The full providers screen with one connected account. */
export const Loaded = meta.story({
  parameters: { bridge: { accounts: seeded } },
});
