import type { CredentialedAccountKind, SubscriptionProviderId } from '@recompose/contracts';
import type { ReactNode } from 'react';

import { subscriptionProviders } from '@recompose/contracts';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useId } from 'react';

import type { CatalogEntry } from '../model/provider-catalog';

import { subscriptionToolsQueryOptions, useSignInSubscription } from '../../../shared/api';
import { CopyButton } from '../../../shared/ui';
import { keyKindOf, signInProviderOf } from '../model/provider-catalog';
import { ConnectKeyForm } from './connect-key-form';

type ProviderConnectForkProps = {
  /** The provider a person picked out of the catalog. */
  entry: CatalogEntry;
  /** Runs once either way finishes, so the catalog can close behind it. */
  onConnected: () => void;
};

type SignInWayProps = {
  name: string;
  provider: SubscriptionProviderId;
  onConnected: () => void;
};

function SignInAction({
  name,
  provider,
  toolName,
  command,
  onConnected,
}: SignInWayProps & { toolName: string; command: string }) {
  const signIn = useSignInSubscription();

  if (signIn.isPending) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-caption text-ink-secondary">
          Waiting for {toolName} to finish signing in.
        </p>
        <p className="flex items-center gap-2 font-mono text-mono-value text-ink">
          <code>{command}</code>
          <CopyButton label={`Copy the ${toolName} sign-in command`} value={command} />
        </p>
      </div>
    );
  }

  return (
    <>
      <button
        className="push-button self-start focus-ring"
        onClick={() => {
          signIn.mutate({ provider }, { onSuccess: onConnected });
        }}
        type="button"
      >
        Sign in to {name}
      </button>
      {signIn.refusal === undefined ? null : (
        <p className="text-caption text-danger-ink" role="alert">
          {signIn.refusal}
        </p>
      )}
    </>
  );
}

function ToolAbsent({ name, toolName }: { name: string; toolName: string }) {
  const reasonId = useId();

  return (
    <>
      <p className="text-caption text-attention-ink" id={reasonId}>
        {toolName} isn&apos;t installed. Install it, then sign in from here.
      </p>
      <button
        aria-describedby={reasonId}
        className="push-button self-start focus-ring disabled:bg-surface-inert disabled:text-ink-secondary"
        disabled
        type="button"
      >
        Sign in to {name}
      </button>
    </>
  );
}

/** One way of connecting, named after what it yields so the name reaches assistive technology. */
function Way({ yields, children }: { yields: string; children: ReactNode }) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-2 rounded-card border border-line-subtle bg-surface-card p-4"
    >
      <h3 className="text-card-title text-ink" id={titleId}>
        {yields}
      </h3>
      {children}
    </section>
  );
}

function SignInWay({ name, provider, onConnected }: SignInWayProps) {
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
      <p className="text-caption text-ink-secondary">
        {name}&apos;s terms govern this connection, and {name} may end access without notice.
      </p>
      {command === undefined ? (
        <ToolAbsent name={name} toolName={toolName} />
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

function KeyWay({
  entry,
  kind,
  onConnected,
}: {
  entry: CatalogEntry;
  kind: CredentialedAccountKind;
  onConnected: () => void;
}) {
  return (
    <Way yields="A target a gateway can reach">
      <p className="text-detail text-ink-secondary">
        A key makes {entry.name} a target any virtual model can route to, charged to that key
        request by request.
      </p>
      <ConnectKeyForm kind={kind} onConnected={onConnected} provider={entry.id} />
    </Way>
  );
}

/**
 * Every way one provider connects, standing together with what each of them yields.
 *
 * @summary Reach for it once a person picks a provider out of the catalog. A provider that both
 * sells a plan and sells a key offers two different things rather than two routes to one thing,
 * so the arms name their yield and the person chooses, instead of the surface choosing for them.
 */
export function ProviderConnectFork({ entry, onConnected }: ProviderConnectForkProps) {
  const provider = signInProviderOf(entry);
  const kind = keyKindOf(entry);

  return (
    <div className="flex flex-col gap-3">
      {provider === undefined ? null : (
        <SignInWay name={entry.name} onConnected={onConnected} provider={provider} />
      )}
      {kind === undefined ? null : <KeyWay entry={entry} kind={kind} onConnected={onConnected} />}
    </div>
  );
}
