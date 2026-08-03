import type { CredentialedAccountKind } from '@recompose/contracts';
import type { ReactNode } from 'react';

import { vendorShapeOf } from '@recompose/contracts';
import { useId, useState } from 'react';

import type { BrandMarkName } from '../../../shared/ui';

import { useConnectAccount, withRefusal } from '../../../shared/api';
import { LabelledTextField } from '../../../shared/ui';
import { keyHostFor, providerName } from '../model/provider-catalog';

type ConnectKeyFormProps = {
  /** The provider the key belongs to, already settled by the catalog entry that opened the form. */
  provider: BrandMarkName;
  /** Which kind the registry holds this key under. */
  kind: CredentialedAccountKind;
  /** Runs once the key is stored, so the surface that opened the form can step aside. */
  onConnected: () => void;
};

function shapeWarning(provider: BrandMarkName, pasted: string): ReactNode {
  const suggested = vendorShapeOf(pasted);

  if (suggested === undefined || suggested === provider) {
    return null;
  }

  return (
    <p className="text-detail text-attention-ink" role="status">
      The key&apos;s shape suggests {providerName(suggested)} rather than {providerName(provider)}.
      Connect it anyway if it belongs here.
    </p>
  );
}

function hostLine(provider: BrandMarkName): ReactNode {
  const host = keyHostFor(provider);

  return host === undefined ? null : (
    <p className="text-detail text-ink-secondary">
      This key reaches <span className="font-mono text-mono-value">{host}</span>
    </p>
  );
}

function nameReason(named: boolean, reasonId: string): ReactNode {
  return named ? null : (
    <p className="text-detail text-ink-secondary" id={reasonId}>
      Name the key, so two keys under one provider never read alike.
    </p>
  );
}

function refusalLine(refusal: string | undefined): ReactNode {
  return refusal === undefined ? null : (
    <p className="text-detail text-danger-ink" role="alert">
      {refusal}
    </p>
  );
}

/**
 * The key half of a provider's fork, asking only what the catalog doesn't already know.
 *
 * @summary Reach for it under a catalog entry's key arm. The provider rides in from the entry
 * rather than being typed again, so the two things left to say are the name and the key. The name
 * is required because two keys under one provider differ by purpose and a person names the purpose.
 * A key whose shape suggests another vendor draws a warning and connects regardless, because a
 * shape gate turns away legitimate keys. A refused connect keeps both drafts, because a person who
 * has just pasted a key should never be asked to find it a second time.
 */
export function ConnectKeyForm({ provider, kind, onConnected }: ConnectKeyFormProps) {
  const connect = withRefusal(useConnectAccount());
  const nameReasonId = useId();
  const [label, setLabel] = useState('');
  const [secret, setSecret] = useState('');

  const named = label.trim() !== '';

  return (
    <>
      <form
        className="mx-auto flex w-80 flex-col gap-2.5 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          connect.mutate({ provider, kind, label, secret }, { onSuccess: onConnected });
        }}
      >
        {hostLine(provider)}
        <LabelledTextField label="Name" onChangeValue={setLabel} value={label} />
        {nameReason(named, nameReasonId)}
        <LabelledTextField label="Key" onChangeValue={setSecret} type="password" value={secret} />
        {shapeWarning(provider, secret)}
        <button
          aria-describedby={named ? undefined : nameReasonId}
          className="mt-1 push-button-primary w-full justify-center focus-ring disabled:bg-surface-inert disabled:text-ink-secondary"
          disabled={connect.isPending || !named}
          type="submit"
        >
          Connect
        </button>
      </form>
      {refusalLine(connect.refusal)}
    </>
  );
}
