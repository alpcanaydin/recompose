import type { CredentialedAccountKind } from '@recompose/contracts';

import { useState } from 'react';

import { useConnectAccount, withRefusal } from '../../../shared/api';
import { LabelledTextField } from '../../../shared/ui';

type ConnectKeyFormProps = {
  /** The provider the key belongs to, already settled by the catalog entry that opened the form. */
  provider: string;
  /** Which kind the registry holds this key under. */
  kind: CredentialedAccountKind;
  /** Runs once the key is stored, so the surface that opened the form can step aside. */
  onConnected: () => void;
};

/**
 * The key half of a provider's fork, asking only what the catalog doesn't already know.
 *
 * @summary Reach for it under a catalog entry's key arm. The provider rides in from the entry
 * rather than being typed again, so the only things left to say are what to call the account and
 * the key itself. A refused connect keeps the draft, because a person who has just pasted a key
 * should never be asked to find it a second time.
 */
export function ConnectKeyForm({ provider, kind, onConnected }: ConnectKeyFormProps) {
  const connect = withRefusal(useConnectAccount());
  const [label, setLabel] = useState('');
  const [secret, setSecret] = useState('');

  return (
    <>
      <form
        className="flex flex-col gap-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          connect.mutate({ provider, kind, label, secret }, { onSuccess: onConnected });
        }}
      >
        <LabelledTextField label="Label" onChangeValue={setLabel} value={label} />
        <LabelledTextField label="Key" onChangeValue={setSecret} type="password" value={secret} />
        <button
          className="push-button self-start focus-ring"
          disabled={connect.isPending}
          type="submit"
        >
          Connect
        </button>
      </form>
      {connect.refusal === undefined ? null : (
        <p className="text-caption text-danger-ink" role="alert">
          {connect.refusal}
        </p>
      )}
    </>
  );
}
