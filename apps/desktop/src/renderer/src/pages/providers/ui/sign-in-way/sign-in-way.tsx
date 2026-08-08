import type { SubscriptionProviderId } from '@recompose/contracts';

import { subscriptionProviders } from '@recompose/contracts';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useId } from 'react';

import { subscriptionToolsQueryOptions } from '../../../../shared/api';
import { SheetActionSlot } from '../../../../shared/ui';
import { subscriptionMarkFor } from '../../model/provider-catalog';
import { PickedIdentity } from '../picked-identity/picked-identity';
import { SignInAction } from '../sign-in-action/sign-in-action';

type SignInWayProps = {
  name: string;
  provider: SubscriptionProviderId;
  onConnected: () => void;
};

/**
 * The subscription connect step, standing the one act the pick still needs.
 *
 * @summary The picked card already said what the plan gives, so this step holds the mark, what
 * the sign-in yields, one sentence naming whose plan and terms carry it, and the act itself at
 * full width. It draws no card of its own, because it already stands inside one surface.
 */
export function SignInWay({ name, provider, onConnected }: SignInWayProps) {
  const reasonId = useId();
  const { data: tools } = useSuspenseQuery(subscriptionToolsQueryOptions);
  const { toolName } = subscriptionProviders[provider];
  const reported = tools.find((tool) => tool.provider === provider);
  const command = reported?.present === true ? reported.signInCommand : undefined;

  return (
    <div className="mx-auto flex w-80 flex-col items-center gap-2.5 py-4 text-center">
      <PickedIdentity provider={subscriptionMarkFor(provider)} title={`An account for ${toolName}`}>
        <p className="text-detail text-ink-secondary">
          {toolName} signs in on its own and spends your {name} plan, under {name}&apos;s terms.
          {` ${toolName} serves one account at a time.`}
        </p>
      </PickedIdentity>
      {command === undefined ? (
        <>
          <p className="text-detail text-attention-ink" id={reasonId}>
            {toolName} isn&apos;t installed. Install it, then sign in from here.
          </p>
          <SheetActionSlot>
            <button
              aria-describedby={reasonId}
              className="push-button-primary focus-ring disabled:bg-surface-inert disabled:text-ink-secondary"
              disabled
              type="button"
            >
              Sign in to {name}
            </button>
          </SheetActionSlot>
        </>
      ) : (
        <SignInAction
          command={command}
          name={name}
          onConnected={onConnected}
          provider={provider}
          toolName={toolName}
        />
      )}
    </div>
  );
}
