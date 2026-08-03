import type {
  AccountsDocument,
  KeyCheckVerdict,
  RecomposeIpc,
  SubscriptionAccountView,
} from '@recompose/contracts';

import { keyTail, subscriptionProviders } from '@recompose/contracts';

type AccountHandlers = Pick<
  RecomposeIpc,
  'accounts:list' | 'accounts:connect' | 'accounts:remove' | 'accounts:check-key'
>;

type AccountsHalf = AccountHandlers & {
  landSubscription: (id: string, provider: SubscriptionAccountView['provider']) => void;
};

/**
 * The accounts half of the fake bridge, holding the registry every kind reads.
 *
 * @summary The real main grows this registry when a sign-in lands, so the fake exposes the same
 * growth through landSubscription, and a screen that never re-asks the registry stays caught. A
 * connect mints the mask tail the way main does, and the check answers the verdict the scenario
 * seeded, because a scenario decides what the provider says rather than the fake deciding.
 */
export function accountHandlers(seed: AccountsDocument, verdict: KeyCheckVerdict): AccountsHalf {
  let registry = seed;
  let nextAccountNumber = registry.accounts.length + 1;

  return {
    landSubscription: (id, provider) => {
      registry = {
        ...registry,
        accounts: [
          ...registry.accounts,
          { id, provider, kind: 'subscription', label: subscriptionProviders[provider].toolName },
        ],
      };
    },
    'accounts:list': async () => Promise.resolve({ ok: true, value: registry }),
    'accounts:connect': async (request) => {
      const id = `a${nextAccountNumber}`;

      nextAccountNumber += 1;

      const tail = keyTail(request.secret);

      registry = {
        ...registry,
        accounts: [
          ...registry.accounts,
          {
            id,
            provider: request.provider,
            kind: request.kind,
            label: request.label,
            credentialRef: `c-${id}`,
            ...(tail === undefined ? {} : { keyTail: tail }),
          },
        ],
      };

      return Promise.resolve({ ok: true, value: registry });
    },
    'accounts:check-key': async () => Promise.resolve({ ok: true as const, value: { verdict } }),
    'accounts:remove': async (request) => {
      registry = {
        ...registry,
        accounts: registry.accounts.filter((row) => row.id !== request.id),
      };

      return Promise.resolve({ ok: true, value: registry });
    },
  };
}
