import type { CredentialedAccountKind } from '@recompose/contracts';

import { useState } from 'react';

import type { BrandMarkName } from '../../../shared/ui';

import { useConnectAccount, withRefusal } from '../../../shared/api';
import { LabelledTextField } from '../../../shared/ui';
import { providerName } from '../model/provider-catalog';

type ConnectKeyFormProps = {
  /** The provider the key belongs to, already settled by the catalog entry that opened the form. */
  provider: BrandMarkName;
  /** Which kind the registry holds this key under. */
  kind: CredentialedAccountKind;
  /** Runs once the key is stored, so the surface that opened the form can step aside. */
  onConnected: () => void;
};

/**
 * The key half of a provider's fork, asking only what the catalog doesn't already know.
 *
 * @summary Reach for it under a catalog entry's key arm. The provider rides in from the entry
 * rather than being typed again and names the account itself, so the only thing left to say is
 * the key. A refused connect keeps the draft, because a person who has just pasted a key should
 * never be asked to find it a second time.
 */
export function ConnectKeyForm({ provider, kind, onConnected }: ConnectKeyFormProps) {
  const connect = withRefusal(useConnectAccount());
  const [secret, setSecret] = useState('');

  return (
    <>
      <form
        className="mx-auto flex w-80 flex-col gap-2.5 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          connect.mutate(
            { provider, kind, label: providerName(provider), secret },
            { onSuccess: onConnected },
          );
        }}
      >
        <LabelledTextField label="Key" onChangeValue={setSecret} type="password" value={secret} />
        <button
          className="mt-1 push-button-primary w-full justify-center focus-ring"
          disabled={connect.isPending}
          type="submit"
        >
          Connect
        </button>
      </form>
      {connect.refusal === undefined ? null : (
        <p className="text-detail text-danger-ink" role="alert">
          {connect.refusal}
        </p>
      )}
    </>
  );
}
