import type {
  Account,
  AccountsDocument,
  IpcRequest,
  KeyCheckVerdict,
  RecomposeIpc,
  RuntimeReachability,
  SubscriptionAccountView,
} from '@recompose/contracts';

import {
  keyTail,
  runtimeAddressFor,
  runtimePortSchema,
  subscriptionProviders,
} from '@recompose/contracts';

type AccountHandlers = Pick<
  RecomposeIpc,
  | 'accounts:list'
  | 'accounts:connect'
  | 'accounts:remove'
  | 'accounts:check-key'
  | 'accounts:connect-local'
  | 'accounts:detect-runtime'
  | 'accounts:check-runtime'
>;

type RuntimeLookHandlers = Pick<RecomposeIpc, 'accounts:detect-runtime' | 'accounts:check-runtime'>;

type AccountsHalf = AccountHandlers & {
  landSubscription: (id: string, provider: SubscriptionAccountView['provider']) => void;
};

function keyRow(id: string, request: IpcRequest<'accounts:connect'>): Account {
  const tail = keyTail(request.secret);

  return {
    id,
    provider: request.provider,
    kind: request.kind,
    label: request.label,
    credentialRef: `c-${id}`,
    ...(tail === undefined ? {} : { keyTail: tail }),
  };
}

function localRow(id: string, request: IpcRequest<'accounts:connect-local'>): Account {
  return {
    id,
    provider: request.runtime,
    kind: 'local',
    address: runtimeAddressFor(request.runtime, runtimePortSchema.optional().parse(request.port)),
  };
}

/**
 * The two looks a runtime answers, neither of which the registry keeps.
 *
 * @summary A scenario decides what the machine says this run, so both looks answer the one seeded
 * reading rather than the fake deciding, and neither stores it.
 */
function runtimeLookHandlers(reachability: RuntimeReachability): RuntimeLookHandlers {
  return {
    'accounts:detect-runtime': async () => Promise.resolve({ ok: true, value: reachability }),
    'accounts:check-runtime': async () => Promise.resolve({ ok: true, value: reachability }),
  };
}

/**
 * The accounts half of the fake bridge, holding the registry every kind reads.
 *
 * @summary The real main grows this registry when a sign-in lands, so the fake exposes the same
 * growth through landSubscription, and a screen that never re-asks the registry stays caught. A
 * connect mints the mask tail the way main does, and the check answers the verdict the scenario
 * seeded. A local connect mints the loopback address around the chosen port the way main does, so
 * no scenario can supply one.
 */
export function accountHandlers(
  seed: AccountsDocument,
  verdict: KeyCheckVerdict,
  reachability: RuntimeReachability,
): AccountsHalf {
  let registry = seed;
  let nextAccountNumber = registry.accounts.length + 1;

  function append(row: Account): AccountsDocument {
    registry = { ...registry, accounts: [...registry.accounts, row] };

    return registry;
  }

  function nextId(): string {
    const id = `a${nextAccountNumber}`;

    nextAccountNumber += 1;

    return id;
  }

  return {
    ...runtimeLookHandlers(reachability),
    landSubscription: (id, provider) => {
      append({
        id,
        provider,
        kind: 'subscription',
        label: subscriptionProviders[provider].toolName,
      });
    },
    'accounts:list': async () => Promise.resolve({ ok: true, value: registry }),
    'accounts:connect': async (request) =>
      Promise.resolve({ ok: true, value: append(keyRow(nextId(), request)) }),
    'accounts:connect-local': async (request) =>
      Promise.resolve({ ok: true, value: append(localRow(nextId(), request)) }),
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
