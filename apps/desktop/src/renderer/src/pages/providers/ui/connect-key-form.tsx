import type { CredentialedAccountKind } from '@recompose/contracts';
import type { ReactNode } from 'react';

import { vendorShapeOf } from '@recompose/contracts';
import { useId, useState } from 'react';

import type { BrandMarkName } from '../../../shared/ui';

import { useConnectAccount, withRefusal } from '../../../shared/api';
import { FieldBoxRow, SheetActionSlot } from '../../../shared/ui';
import { keyHostFor, keyShapeHintFor, keyTitleFor, providerName } from '../model/provider-catalog';
import { PickedIdentity } from './picked-identity';

type ConnectKeyFormProps = {
  /** The provider the key belongs to, already settled by the catalog entry that opened the form. */
  provider: BrandMarkName;
  /** Which kind the registry holds this key under. */
  kind: CredentialedAccountKind;
  /** Runs once the key is stored, so the surface that opened the form can step aside. */
  onConnected: () => void;
};

function pickedProduct(provider: BrandMarkName): ReactNode {
  const host = keyHostFor(provider);

  return (
    <PickedIdentity provider={provider} title={keyTitleFor(provider)}>
      {host === undefined ? null : (
        <p className="text-detail text-ink-secondary">
          This key reaches <span className="font-mono text-mono-value">{host}</span>
        </p>
      )}
    </PickedIdentity>
  );
}

function shapeWarning(provider: BrandMarkName, pasted: string): ReactNode {
  const suggested = vendorShapeOf(pasted);

  if (suggested === undefined || suggested === provider) {
    return null;
  }

  return (
    <p className="mt-1.5 px-0.5 text-caption text-attention-ink" role="status">
      The key&apos;s shape suggests {providerName(suggested)} rather than {providerName(provider)}.
      Connect it anyway if it belongs here.
    </p>
  );
}

type ConnectAct = {
  formId: string;
  named: boolean;
  pending: boolean;
  nameReasonId: string;
};

function connectAct({ formId, named, pending, nameReasonId }: ConnectAct): ReactNode {
  return (
    <SheetActionSlot>
      <button
        aria-describedby={named ? undefined : nameReasonId}
        className="push-button-primary focus-ring disabled:bg-surface-inert disabled:text-ink-secondary"
        disabled={pending || !named}
        form={formId}
        type="submit"
      >
        Connect
      </button>
    </SheetActionSlot>
  );
}

function refusalLine(refusal: string | undefined): ReactNode {
  return refusal === undefined ? null : (
    <p className="mt-1.5 px-0.5 text-caption text-danger-ink" role="alert">
      {refusal}
    </p>
  );
}

/**
 * The key half of a provider's fork, asking only what the catalog doesn't already know.
 *
 * @summary Reach for it under a catalog entry's key arm. The picked product stands centered over
 * the fields in the mark-and-heading anatomy the subscription step ships, so the page says whose
 * key it takes. The two things left to say are the name and the key, each hinted in the shape the
 * provider hands out. The name is required because two keys under one provider differ by purpose
 * and a person names the purpose, and its guidance stands whether or not a name has arrived, so
 * the form never jumps. The connect act settles the sheet, so it rides the sheet's foot beside
 * Cancel. A key whose shape suggests another vendor draws a warning and connects regardless. A
 * refused connect keeps both drafts, because a person who has just pasted a key should never be
 * asked to find it a second time.
 */
export function ConnectKeyForm({ provider, kind, onConnected }: ConnectKeyFormProps) {
  const connect = withRefusal(useConnectAccount());
  const formId = useId();
  const nameReasonId = useId();
  const [label, setLabel] = useState('');
  const [secret, setSecret] = useState('');

  const named = label.trim() !== '';

  return (
    <>
      <form
        className="flex flex-col py-2"
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          connect.mutate({ provider, kind, label, secret }, { onSuccess: onConnected });
        }}
      >
        {pickedProduct(provider)}
        <div className="mt-4 field-box">
          <FieldBoxRow
            controlClasses="w-sheet-secret"
            label="Name"
            onChangeValue={setLabel}
            placeholder="Work"
            value={label}
          />
          <FieldBoxRow
            controlClasses="w-sheet-secret"
            label="Key"
            onChangeValue={setSecret}
            placeholder={keyShapeHintFor(provider)}
            type="password"
            value={secret}
          />
        </div>
        <p className="mt-2.5 px-0.5 text-caption text-ink-secondary" id={nameReasonId}>
          Name the key, so two keys under one provider never read alike.
        </p>
        {shapeWarning(provider, secret)}
        {refusalLine(connect.refusal)}
      </form>
      {connectAct({ formId, named, pending: connect.isPending, nameReasonId })}
    </>
  );
}
