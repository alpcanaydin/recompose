import type { SubscriptionAccount } from '@recompose/contracts';

import type { CredentialCustody, CustodyOutcome } from './credential-custody';
import type { SubscriptionHomes } from './subscription-homes';

import { custodyOver, RESERVED_SLOT } from './credential-custody';

export type SubscriptionRelease = (
  row: SubscriptionAccount,
  survivors: readonly string[],
) => Promise<CustodyOutcome>;

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
      return { ok: true };
    }

    const forgotten = await keeper.forget(row.id);

    if (!stoodHere) {
      return forgotten;
    }

    const placed = await keeper.place(settled ?? RESERVED_SLOT);

    return forgotten.ok ? placed : forgotten;
  };
}
