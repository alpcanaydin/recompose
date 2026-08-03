import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useId } from 'react';

import type { IconName } from '../../../../../shared/ui';

import {
  type AccountKind,
  accountKindTitle,
  accountKinds,
  accountsOfKind,
} from '../../../../../entities/account';
import { accountsQueryOptions } from '../../../../../shared/api';
import { Icon } from '../../../../../shared/ui';

const glyph: Record<AccountKind, IconName> = {
  subscription: 'person',
  'api-key': 'key',
  aggregator: 'cube',
  local: 'monitor',
};

const tint: Record<AccountKind, string> = {
  subscription: 'text-subscription',
  'api-key': 'text-api-key',
  aggregator: 'text-aggregator',
  local: 'text-local',
};

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
    <div aria-labelledby={groupId} className="flex flex-col gap-px" role="group">
      <h2 className="nav-group" id={groupId}>
        Providers
      </h2>
      {accountKinds.map((kind) => {
        const connected = accountsOfKind(registry.accounts, kind).length;

        return (
          <Link
            activeOptions={{ includeSearch: true }}
            aria-label={`${accountKindTitle(kind)}, ${String(connected)} connected`}
            className="nav-item"
            key={kind}
            search={{ kind }}
            to="/providers"
          >
            <Icon className={`size-4 ${tint[kind]}`} name={glyph[kind]} />
            <span className="truncate">{accountKindTitle(kind)}</span>
            <span className="ms-auto font-mono text-mono-value text-ink-secondary">
              {connected}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
