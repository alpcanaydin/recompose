import type { Account, AccountsDocument } from '@recompose/contracts';

import type { OptionGroup, OptionRow } from '../ui/option-list/option-list';

import {
  accountKindTitle,
  accountKinds,
  accountMark,
  accountName,
  accountsOfKind,
  accountsStandingAsTarget,
} from '../../../entities/account';

function optionFor(account: Account): OptionRow {
  const mark = accountMark(account);

  return {
    id: account.id,
    name: accountName(account),
    ...(mark === undefined ? {} : { mark }),
    ...(account.kind === 'local' ? { detail: account.address } : {}),
  };
}

/**
 * The accounts a target can name, gathered the way the picker offers them.
 *
 * @summary A subscription is dropped before anything is gathered, so it stands under no heading
 * rather than under a disabled one, and the kinds keep the registry's own order. A kind holding
 * nothing offered stands as no group, because an empty heading says only that a person has none.
 */
export function targetGroups(accounts: AccountsDocument['accounts']): readonly OptionGroup[] {
  const offered = accountsStandingAsTarget(accounts);
  const gathered: OptionGroup[] = [];

  for (const kind of accountKinds) {
    const options = accountsOfKind(offered, kind).map(optionFor);

    if (options.length > 0) {
      gathered.push({ heading: accountKindTitle(kind), options });
    }
  }

  return gathered;
}
