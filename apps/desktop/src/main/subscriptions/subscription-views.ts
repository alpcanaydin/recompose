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
