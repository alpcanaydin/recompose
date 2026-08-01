import type { SubscriptionAccount } from '@recompose/contracts';

import type { CredentialCustody } from './credential-custody';
import type { SubscriptionHomes } from './subscription-homes';

import { custodyOver, RESERVED_SLOT } from './credential-custody';

export type SubscriptionRelease = (
  row: SubscriptionAccount,
  survivors: readonly string[],
) => Promise<void>;

export function subscriptionRelease(
  homes: SubscriptionHomes,
  custody: CredentialCustody | null,
): SubscriptionRelease {
  return async (row, survivors) => {
    const keeper = custodyOver(custody, row.provider);
    const stoodHere = (await homes.readActive(row.provider)) === row.id;

    await homes.removeHome(row.provider, row.id);

    const settled = await homes.healActive(row.provider, survivors);

    if (keeper === null) {
      return;
    }

    await keeper.forget(row.id);

    if (stoodHere) {
      await keeper.place(settled ?? RESERVED_SLOT);
    }
  };
}
