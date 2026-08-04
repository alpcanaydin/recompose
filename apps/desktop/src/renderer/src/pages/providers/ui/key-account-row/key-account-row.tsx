import type { CredentialedAccount, KeyCheckVerdict } from '@recompose/contracts';
import type { ReactNode } from 'react';

import { useVerifyKey, useRemoveAccount, withRefusal } from '../../../../shared/api';
import { BrandMark, OverflowMenu } from '../../../../shared/ui';
import { checkableKey, keyTitleFor, markFor } from '../../model/provider-catalog';

type KeyAccountRowProps = {
  /** The stored key as the registry holds it, which is everything the row may read. */
  account: CredentialedAccount;
};

const answered: Record<KeyCheckVerdict, { sentence: string; ink: string }> = {
  authenticates: {
    sentence: 'This key authenticated as of this check.',
    ink: 'text-ink',
  },
  'not-accepted': {
    sentence: "The provider didn't accept this key as of this check.",
    ink: 'text-attention-ink',
  },
  'could-not-check': {
    sentence: "This check couldn't reach the provider, so the key stands unverified.",
    ink: 'text-ink-secondary',
  },
};

const maskedBullets = '••••';

function keyIdentity(
  account: CredentialedAccount,
  refusal: string | undefined,
  verdict: KeyCheckVerdict | undefined,
): ReactNode {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-card-title text-ink">{keyTitleFor(account.provider)}</span>
      <span className="flex min-w-0 items-center gap-2 text-detail text-ink-secondary">
        <span className="truncate">{account.label}</span>
        <span className="font-mono text-mono-value">{`${maskedBullets}${account.keyTail ?? ''}`}</span>
      </span>
      {refusal === undefined ? null : (
        <span className="text-detail text-danger-ink" role="alert">
          {refusal}
        </span>
      )}
      {verdict === undefined ? null : (
        <span className={`text-detail ${answered[verdict].ink}`} role="status">
          {answered[verdict].sentence}
        </span>
      )}
    </div>
  );
}

type RowActs = {
  account: CredentialedAccount;
  checking: boolean;
  onVerify: () => void;
  onRemove: () => void;
};

function quieterActions({ account, checking, onVerify, onRemove }: RowActs) {
  return [
    ...(checkableKey(account)
      ? [
          {
            label: 'Verify',
            icon: 'shield' as const,
            tone: 'positive' as const,
            disabled: checking,
            onSelect: onVerify,
          },
        ]
      : []),
    { label: 'Remove', icon: 'trash' as const, tone: 'danger' as const, onSelect: onRemove },
  ];
}

/**
 * One stored key, read leading to trailing as the product it reaches and the key it holds.
 *
 * @summary The row is the whole surface for a key, because a key is never edited once stored: it
 * is replaced. It holds two lines, the product its catalog entry was picked as and the name beside
 * the mask, so a person tells two keys of one provider apart without the secret reaching the
 * screen. The bullets stand on every key row, so a card always says a key stands there, and a key
 * stored before the mask existed reads the name beside the bare bullets. Both acts live behind the
 * overflow, because neither is part of reading the row, and Verify appears there only where a
 * probe knows the provider well enough to answer.
 */
export function KeyAccountRow({ account }: KeyAccountRowProps) {
  const check = withRefusal(useVerifyKey());
  const forget = withRefusal(useRemoveAccount());

  const mark = markFor(account.provider);

  return (
    <li className="flex min-h-row items-center gap-3 rounded-card border border-line-subtle bg-surface-card px-4 py-2.5">
      {mark === undefined ? null : <BrandMark name={mark} />}
      {keyIdentity(account, check.refusal ?? forget.refusal, check.data?.verdict)}
      <OverflowMenu
        items={quieterActions({
          account,
          checking: check.isPending,
          onVerify: () => {
            check.mutate({ id: account.id });
          },
          onRemove: () => {
            forget.mutate({ id: account.id });
          },
        })}
        label={`Actions for ${account.label}`}
      />
    </li>
  );
}
