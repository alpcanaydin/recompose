import type { SubscriptionProviderId } from '@recompose/contracts';

import { subscriptionProviders } from '@recompose/contracts';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useId } from 'react';

import { subscriptionToolsQueryOptions } from '../../../shared/api';
import { BrandMark } from '../../../shared/ui';
import { SignInAction } from './sign-in-action';

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
      <span className="flex size-11 items-center justify-center rounded-card border border-line-subtle bg-surface-raised">
        <BrandMark className="size-6" name={provider} />
      </span>
      <h3 className="text-heading text-ink">{`An account for ${toolName}`}</h3>
      <p className="text-detail text-ink-secondary">
        {toolName} signs in on its own and spends your {name} plan, under {name}&apos;s terms.
        {` ${toolName} serves one account at a time.`}
      </p>
      {command === undefined ? (
        <>
          <p className="text-detail text-attention-ink" id={reasonId}>
            {toolName} isn&apos;t installed. Install it, then sign in from here.
          </p>
          <button
            aria-describedby={reasonId}
            className="mt-1 push-button-primary w-full justify-center focus-ring disabled:bg-surface-inert disabled:text-ink-secondary"
            disabled
            type="button"
          >
            Sign in to {name}
          </button>
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
