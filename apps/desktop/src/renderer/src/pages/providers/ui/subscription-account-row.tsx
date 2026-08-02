import type { SubscriptionAccountView } from '@recompose/contracts';

import { subscriptionProviders } from '@recompose/contracts';
import { useSuspenseQuery } from '@tanstack/react-query';

import {
  subscriptionToolsQueryOptions,
  useActivateSubscription,
  useForgetSubscription,
  useRestoreSubscription,
} from '../../../shared/api';
import { Badge, BrandMark, OverflowMenu, StatusChip } from '../../../shared/ui';

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
  shellSetupLine: string | undefined;
  onUse: () => void;
  onSignInAgain: () => void;
  onRemove: () => void;
};

function quieterActions({ view, shellSetupLine, onUse, onSignInAgain, onRemove }: RowActions) {
  return [
    ...(view.active ? [] : [{ label: 'Use this account', onSelect: onUse }]),
    ...(view.standing === 'lapsed' ? [] : [{ label: 'Sign in again', onSelect: onSignInAgain }]),
    ...(shellSetupLine === undefined
      ? []
      : [
          {
            label: 'Copy shell setup',
            onSelect: () => {
              void navigator.clipboard.writeText(shellSetupLine);
            },
          },
        ]),
    { label: 'Remove', onSelect: onRemove },
  ];
}

function firstRefusal(refusals: readonly (string | undefined)[]) {
  return refusals.find((refusal) => refusal !== undefined);
}

type AccountIdentityProps = {
  view: SubscriptionAccountView;
  refusal: string | undefined;
};

function AccountIdentity({ view, refusal }: AccountIdentityProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="flex items-center gap-1.5">
        <span className="text-body text-ink">{view.label}</span>
        {view.plan === undefined ? null : <Badge>{view.plan}</Badge>}
      </span>
      {view.signedInAs === undefined ? null : (
        <span className="text-caption text-ink-secondary">{view.signedInAs}</span>
      )}
      <span className="text-caption text-ink-secondary">
        {`Serves ${subscriptionProviders[view.provider].toolName} from this account's quota.`}
      </span>
      {refusal === undefined ? null : (
        <span className="text-caption text-danger-ink" role="alert">
          {refusal}
        </span>
      )}
    </div>
  );
}

/**
 * One subscription account, read leading to trailing as who it is, what it serves, and how it stands.
 *
 * @summary The row is the whole surface for an account, because a subscription is never a gateway
 * target and has nowhere else to be edited. A lapse puts its remedy on the row rather than behind
 * the overflow, so the standing and the way out of it are read in one glance.
 */
export function SubscriptionAccountRow({ view }: SubscriptionAccountRowProps) {
  const tools = useSuspenseQuery(subscriptionToolsQueryOptions);
  const restore = useRestoreSubscription();
  const activate = useActivateSubscription();
  const forget = useForgetSubscription();

  const tool = tools.data.find((candidate) => candidate.provider === view.provider);
  const refusal = firstRefusal([restore.refusal, activate.refusal, forget.refusal]);

  const signInAgain = () => {
    restore.mutate({ id: view.id });
  };

  return (
    <li className="flex min-h-row items-center gap-3 rounded-card border border-line-subtle bg-surface-card px-4 py-2.5">
      <BrandMark name={view.provider} />
      <AccountIdentity refusal={refusal} view={view} />
      {view.standing === 'lapsed' ? (
        <button className="push-button focus-ring" onClick={signInAgain} type="button">
          Sign in again
        </button>
      ) : null}
      <StatusChip tone={standing[view.standing].tone} word={standing[view.standing].word} />
      <OverflowMenu
        items={quieterActions({
          view,
          shellSetupLine: tool?.shellSetupLine,
          onUse: () => {
            activate.mutate({ id: view.id });
          },
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
