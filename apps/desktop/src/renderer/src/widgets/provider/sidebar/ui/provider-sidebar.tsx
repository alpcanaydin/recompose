import { useSuspenseQuery } from '@tanstack/react-query';
import { useId } from 'react';

import type { IconName } from '../../../../shared/ui';

import {
  type AccountKind,
  accountKindTitle,
  accountKinds,
  accountsOfKind,
} from '../../../../entities/account';
import { accountsQueryOptions } from '../../../../shared/api';
import { Icon } from '../../../../shared/ui';

const glyph: Record<AccountKind, IconName> = {
  subscription: 'person',
  'api-key': 'key',
  aggregator: 'cube',
  local: 'spark',
};

const tint: Record<AccountKind, string> = {
  subscription: 'text-subscription',
  'api-key': 'text-api-key',
  aggregator: 'text-aggregator',
  local: 'text-ink-secondary',
};

type ProviderKindRowProps = {
  /** Which kind of account the row filters the providers surface down to. */
  kind: AccountKind;
  /** How many accounts are stored under that kind right now. */
  connected: number;
};

function ProviderKindRow({ kind, connected }: ProviderKindRowProps) {
  const title = accountKindTitle(kind);

  return (
    <a
      aria-label={`${title}, ${connected} connected`}
      className="nav-item text-ink"
      href={`#/providers?kind=${kind}`}
    >
      <Icon className={`size-4 ${tint[kind]}`} name={glyph[kind]} />
      <span className="truncate">{title}</span>
      <span className="ms-auto font-mono text-mono-value text-ink-secondary">{connected}</span>
    </a>
  );
}

/**
 * One row per kind of account, each reporting how many are stored under it.
 *
 * @summary Reach for it in the app shell's sidebar. Each row is a filter over the accounts the
 * app already holds, so the count beside it is a reading rather than a decoration, and the word
 * beside the count is what a screen reader needs to make sense of a bare number.
 */
export function ProviderSidebar() {
  const groupId = useId();
  const { data: registry } = useSuspenseQuery(accountsQueryOptions);

  return (
    <div aria-labelledby={groupId} className="flex flex-col" role="group">
      <h2 className="nav-group" id={groupId}>
        Providers
      </h2>
      {accountKinds.map((kind) => (
        <ProviderKindRow
          connected={accountsOfKind(registry.accounts, kind).length}
          key={kind}
          kind={kind}
        />
      ))}
    </div>
  );
}
