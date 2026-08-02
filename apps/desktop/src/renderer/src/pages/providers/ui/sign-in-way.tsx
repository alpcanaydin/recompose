import type { SubscriptionProviderId } from '@recompose/contracts';

import { subscriptionProviders } from '@recompose/contracts';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useId } from 'react';

import { subscriptionToolsQueryOptions } from '../../../shared/api';
import { SignInAction } from './sign-in-action';
import { Way } from './way';

type SignInWayProps = {
  name: string;
  provider: SubscriptionProviderId;
  onConnected: () => void;
};

/** The subscription arm of the fork, which yields an account for the provider's own tool. */
export function SignInWay({ name, provider, onConnected }: SignInWayProps) {
  const reasonId = useId();
  const { data: tools } = useSuspenseQuery(subscriptionToolsQueryOptions);
  const { toolName } = subscriptionProviders[provider];
  const reported = tools.find((tool) => tool.provider === provider);
  const command = reported?.present === true ? reported.signInCommand : undefined;

  return (
    <Way yields={`An account for ${toolName}`}>
      <p className="text-detail text-ink-secondary">
        {toolName} signs in and renews on its own. Requests draw on your {name} plan&apos;s own
        limits, and no gateway ever routes through it.
      </p>
      <p className="text-detail text-ink-secondary">
        {name}&apos;s terms govern this connection, and {name} may end access without notice.
      </p>
      {command === undefined ? (
        <>
          <p className="text-detail text-attention-ink" id={reasonId}>
            {toolName} isn&apos;t installed. Install it, then sign in from here.
          </p>
          <button
            aria-describedby={reasonId}
            className="push-button-primary self-start focus-ring disabled:bg-surface-inert disabled:text-ink-secondary"
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
    </Way>
  );
}
