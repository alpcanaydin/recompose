import type { SubscriptionProviderId } from '@recompose/contracts';

import { useSignInSubscription } from '../../../shared/api';
import { CopyButton, SheetActionSlot } from '../../../shared/ui';

type SignInActionProps = {
  name: string;
  provider: SubscriptionProviderId;
  onConnected: () => void;
  toolName: string;
  command: string;
};

/** The act that hands the sign-in to the provider's tool, and the waiting it turns into. */
export function SignInAction({
  name,
  provider,
  toolName,
  command,
  onConnected,
}: SignInActionProps) {
  const signIn = useSignInSubscription();

  if (signIn.isPending) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-detail text-ink-secondary">
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
      {signIn.refusal === undefined ? null : (
        <p className="text-detail text-danger-ink" role="alert">
          {signIn.refusal}
        </p>
      )}
      <SheetActionSlot>
        <button
          className="push-button-primary focus-ring"
          onClick={() => {
            signIn.mutate({ provider }, { onSuccess: onConnected });
          }}
          type="button"
        >
          Sign in to {name}
        </button>
      </SheetActionSlot>
    </>
  );
}
