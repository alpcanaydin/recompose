import type { SubscriptionAccountView } from '@recompose/contracts';
import type { ReactNode } from 'react';

import { useForgetSubscription, useRestoreSubscription } from '../../../../shared/api';
import { Badge, BrandMark, OverflowMenu, StatusChip } from '../../../../shared/ui';
import { subscriptionTitleFor } from '../../model/provider-catalog';

type SubscriptionAccountRowProps = {
  /** The account as the machine last observed it, standing for one row. */
  view: SubscriptionAccountView;
};

const standing = {
  connected: { word: 'Connected', tone: 'positive' },
  lapsed: { word: 'Signed out', tone: 'attention' },
} as const;

type RowActions = {
  view: SubscriptionAccountView;
  onSignInAgain: () => void;
  onRemove: () => void;
};

function quieterActions({ view, onSignInAgain, onRemove }: RowActions) {
  return [
    ...(view.standing === 'lapsed'
      ? []
      : [
          {
            label: 'Sign in again',
            icon: 'renew' as const,
            tone: 'accent' as const,
            onSelect: onSignInAgain,
          },
        ]),
    { label: 'Remove', icon: 'trash' as const, tone: 'danger' as const, onSelect: onRemove },
  ];
}

function firstRefusal(refusals: readonly (string | undefined)[]) {
  return refusals.find((refusal) => refusal !== undefined);
}

function accountIdentity(view: SubscriptionAccountView, refusal: string | undefined): ReactNode {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="flex items-center gap-1.5">
        <span className="text-card-title text-ink">{subscriptionTitleFor(view.provider)}</span>
        {view.plan === undefined ? null : <Badge>{view.plan}</Badge>}
      </span>
      <span className="text-detail text-ink-secondary">{view.signedInAs ?? view.label}</span>
      {refusal === undefined ? null : (
        <span className="text-detail text-danger-ink" role="alert">
          {refusal}
        </span>
      )}
    </div>
  );
}

/**
 * One subscription account, read leading to trailing as who it is and how it stands.
 *
 * @summary The row is the whole surface for an account, because a subscription is never a gateway
 * target and has nowhere else to be edited. It holds two lines, the plan product and the address
 * it signed in as, because the connect step already taught what the account serves. A lapse puts
 * its remedy on the row rather than behind the overflow, so the standing and the way out of it
 * are read in one glance, and the overflow keeps only signing in again and removal.
 */
export function SubscriptionAccountRow({ view }: SubscriptionAccountRowProps) {
  const restore = useRestoreSubscription();
  const forget = useForgetSubscription();

  const refusal = firstRefusal([restore.refusal, forget.refusal]);

  const signInAgain = () => {
    restore.mutate({ id: view.id });
  };

  return (
    <li className="flex min-h-row items-center gap-3 rounded-card border border-line-subtle bg-surface-card px-4 py-2.5">
      <BrandMark name={view.provider} />
      {accountIdentity(view, refusal)}
      {view.standing === 'lapsed' ? (
        <button className="push-button focus-ring" onClick={signInAgain} type="button">
          Sign in again
        </button>
      ) : null}
      <StatusChip tone={standing[view.standing].tone} word={standing[view.standing].word} />
      <OverflowMenu
        items={quieterActions({
          view,
          onSignInAgain: signInAgain,
          onRemove: () => {
            forget.mutate({ id: view.id });
          },
        })}
        label={`Actions for ${view.label}`}
      />
    </li>
  );
}
