import type { AccountsDocument } from '@recompose/contracts';

import preview from '#.storybook/preview';

import { AccountList } from './account-list';

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
    {
      id: 'a2',
      provider: 'openrouter',
      kind: 'api-key',
      label: 'Fallback key',
      credentialRef: 'c2',
    },
  ],
};

const meta = preview.meta({
  component: AccountList,
});

/** Two connected accounts with their remove affordances. */
export const Populated = meta.story({
  args: { accounts: seeded.accounts },
  parameters: { bridge: { accounts: seeded } },
});

/** No accounts connected yet. */
export const Empty = meta.story({
  args: { accounts: [] },
});
