import type { CredentialedAccount, KeyCheckVerdict } from '@recompose/contracts';
import type { ReactNode } from 'react';

import { useVerifyKey, useRemoveAccount, withRefusal } from '../../../shared/api';
import { BrandMark, OverflowMenu } from '../../../shared/ui';
import { checkableKey, keyTitleFor, markFor } from '../model/provider-catalog';

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
        {account.keyTail === undefined ? null : (
          <span className="font-mono text-mono-value">{`${maskedBullets}${account.keyTail}`}</span>
        )}
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

/**
 * One stored key, read leading to trailing as the product it reaches and the key it holds.
 *
 * @summary The row is the whole surface for a key, because a key is never edited once stored: it
 * is replaced. It holds two lines, the product its catalog entry was picked as and the name beside
 * the mask, so a person tells two keys of one provider apart without the secret reaching the
 * screen. A key stored before the mask existed shows its name alone. The check act stands on the
 * row rather than behind the overflow, because it is the one thing a person comes here to ask, and
 * it appears only where a probe knows the provider well enough to answer.
 */
export function KeyAccountRow({ account }: KeyAccountRowProps) {
  const check = withRefusal(useVerifyKey());
  const forget = withRefusal(useRemoveAccount());

  const mark = markFor(account.provider);

  return (
    <li className="flex min-h-row items-center gap-3 rounded-card border border-line-subtle bg-surface-card px-4 py-2.5">
      {mark === undefined ? null : <BrandMark name={mark} />}
      {keyIdentity(account, check.refusal ?? forget.refusal, check.data?.verdict)}
      {checkableKey(account) ? (
        <button
          className="push-button focus-ring disabled:text-ink-secondary"
          disabled={check.isPending}
          onClick={() => {
            check.mutate({ id: account.id });
          }}
          type="button"
        >
          Verify
        </button>
      ) : null}
      <OverflowMenu
        items={[
          {
            label: 'Remove',
            onSelect: () => {
              forget.mutate({ id: account.id });
            },
          },
        ]}
        label={`Actions for ${account.label}`}
      />
    </li>
  );
}
