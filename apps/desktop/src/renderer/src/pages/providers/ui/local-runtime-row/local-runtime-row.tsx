import type { LocalAccount, RuntimeReachability } from '@recompose/contracts';
import type { ReactNode } from 'react';

import { useQuery } from '@tanstack/react-query';

import {
  refusalSentence,
  runtimeStandingQueryOptions,
  useRemoveAccount,
  withRefusal,
} from '../../../../shared/api';
import { BrandMark, OverflowMenu, StatusChip } from '../../../../shared/ui';
import { providerName } from '../../model/provider-catalog';

type LocalRuntimeRowProps = {
  /** The stored runtime as the registry holds it, which is a name and an address alone. */
  account: LocalAccount;
};

const standingWords: Record<
  RuntimeReachability['verdict'],
  { word: string; tone: 'positive' | 'attention' | 'inert' }
> = {
  answers: { word: 'Running', tone: 'positive' },
  unreachable: { word: 'Not running', tone: 'inert' },
  unrecognized: { word: 'Another server answered', tone: 'attention' },
};

function observedStanding(
  looking: boolean,
  reachability: RuntimeReachability | undefined,
): ReactNode {
  if (looking) {
    return <span className="text-detail text-ink-secondary">Checking</span>;
  }

  if (reachability === undefined) {
    return null;
  }

  const standing = standingWords[reachability.verdict];

  return <StatusChip tone={standing.tone} word={standing.word} />;
}

/**
 * One stored runtime, read leading to trailing as who it is and whether it answers right now.
 *
 * @summary The standing is an observation rather than a stored fact: the row looks again on every
 * mount and on every Check again, and a remount forgets the last answer, so no row carries a claim
 * older than its own screen. Both acts live behind the overflow, because neither is part of
 * reading the row, and removing releases nothing since a local account holds no secret.
 */
export function LocalRuntimeRow({ account }: LocalRuntimeRowProps) {
  const standing = useQuery(runtimeStandingQueryOptions(account.id));
  const forget = withRefusal(useRemoveAccount());

  const name = providerName(account.provider);
  const refusal = standing.error === null ? forget.refusal : refusalSentence(standing.error);

  return (
    <li className="flex min-h-row items-center gap-3 rounded-card border border-line-subtle bg-surface-card px-4 py-2.5">
      <BrandMark name={account.provider} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-card-title text-ink">{name}</span>
        <span className="font-mono text-mono-value text-ink-secondary">{account.address}</span>
        {refusal === undefined ? null : (
          <span className="text-detail text-danger-ink" role="alert">
            {refusal}
          </span>
        )}
      </div>
      {observedStanding(standing.isFetching, standing.data)}
      <OverflowMenu
        items={[
          {
            label: 'Check again',
            icon: 'renew',
            tone: 'accent',
            onSelect: () => {
              void standing.refetch();
            },
          },
          {
            label: 'Remove',
            icon: 'trash',
            tone: 'danger',
            onSelect: () => {
              forget.mutate({ id: account.id });
            },
          },
        ]}
        label={`Actions for ${name}`}
      />
    </li>
  );
}
