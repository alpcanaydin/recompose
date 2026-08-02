import type {
  AccountsDocument,
  SubscriptionAccount,
  SubscriptionAccountView,
  SubscriptionProviderId,
} from '@recompose/contracts';

import { subscriptionProviderIdSchema } from '@recompose/contracts';

import type { CredentialCustody } from './credential-custody';
import type { SubscriptionHomes } from './subscription-homes';

import { custodyOver } from './credential-custody';
import { observeSubscription } from './subscription-standing';

export type SubscriptionViewRequest = {
  homes: SubscriptionHomes;
  custody: CredentialCustody | null;
};

type WhoIsActive = Map<SubscriptionProviderId, string | null>;

export function isSubscription(
  row: AccountsDocument['accounts'][number],
): row is SubscriptionAccount {
  return row.kind === 'subscription';
}

async function whoIsActive(homes: SubscriptionHomes): Promise<WhoIsActive> {
  return new Map(
    await Promise.all(
      subscriptionProviderIdSchema.options.map(
        async (provider): Promise<[SubscriptionProviderId, string | null]> => [
          provider,
          await homes.readActive(provider),
        ],
      ),
    ),
  );
}

async function viewOf(
  request: SubscriptionViewRequest,
  row: SubscriptionAccount,
  active: WhoIsActive,
): Promise<SubscriptionAccountView> {
  const custody = custodyOver(request.custody, row.provider);
  const observed = await observeSubscription({
    provider: row.provider,
    home: request.homes.homeFor(row.provider, row.id),
    outsideCredential: custody === null ? null : async () => custody.parkedStands(row.id),
  });

  return {
    id: row.id,
    provider: row.provider,
    label: row.label,
    standing: observed.standing,
    active: active.get(row.provider) === row.id,
    ...(observed.signedInAs === undefined ? {} : { signedInAs: observed.signedInAs }),
    ...(observed.plan === undefined ? {} : { plan: observed.plan }),
  };
}

/**
 * The held account already signing in as an address, and nothing when no account does.
 *
 * @summary Reach for it when a sign-in returns, because the tool only names the address once it
 * finishes. The match reads each home's identity records rather than the stored label, so an
 * account recorded before its address was known still counts as the same account.
 */
export async function heldUnderTheAddress(
  homes: SubscriptionHomes,
  accounts: AccountsDocument,
  provider: SubscriptionProviderId,
  address: string | undefined,
): Promise<string | null> {
  if (address === undefined) {
    return null;
  }

  const rows = accounts.accounts.filter((row) => isSubscription(row) && row.provider === provider);
  const identities = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      observed: await observeSubscription({
        provider,
        home: homes.homeFor(provider, row.id),
        outsideCredential: null,
      }),
    })),
  );

  return identities.find(({ observed }) => observed.signedInAs === address)?.id ?? null;
}

export async function subscriptionViews(
  request: SubscriptionViewRequest,
  accounts: AccountsDocument,
): Promise<SubscriptionAccountView[]> {
  const active = await whoIsActive(request.homes);
  const pending: Promise<SubscriptionAccountView>[] = [];

  for (const row of accounts.accounts) {
    if (isSubscription(row)) {
      pending.push(viewOf(request, row, active));
    }
  }

  return Promise.all(pending);
}
