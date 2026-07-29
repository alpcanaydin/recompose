import type { IpcRequest } from '@recompose/contracts';
import type { SubmitEvent } from 'react';

import { useState } from 'react';

import { LabelledTextField } from '../../../shared/ui';
import { useConnectAccount } from '../api/accounts';
import { AccountKindField } from './account-kind-field';

type Draft = IpcRequest<'accounts:connect'>;

const emptyDraft: Draft = {
  provider: '',
  kind: 'api-key',
  label: '',
  secret: '',
};

const textEntries = [
  { field: 'provider', label: 'Provider', type: 'text' },
  { field: 'label', label: 'Label', type: 'text' },
  { field: 'secret', label: 'Secret', type: 'password' },
] as const satisfies readonly {
  field: keyof Omit<Draft, 'kind'>;
  label: string;
  type: 'password' | 'text';
}[];

/** Form for connecting a new provider account. */
export function ConnectAccountForm() {
  const connect = useConnectAccount();
  const [draft, setDraft] = useState(emptyDraft);

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    connect.mutate(draft, {
      onSuccess: () => {
        setDraft(emptyDraft);
      },
    });
  };

  return (
    <>
      <form className="flex flex-col items-start gap-3" onSubmit={handleSubmit}>
        {textEntries.map(({ field, label, type }) => (
          <LabelledTextField
            key={field}
            label={label}
            onChangeValue={(next) => {
              setDraft({ ...draft, [field]: next });
            }}
            type={type}
            value={draft[field]}
          />
        ))}
        <AccountKindField
          onChangeValue={(kind) => {
            setDraft({ ...draft, kind });
          }}
          value={draft.kind}
        />
        <button className="push-button focus-ring" type="submit">
          Connect
        </button>
      </form>
      {connect.error === null ? null : (
        <p className="text-caption text-danger-ink" role="alert">
          {connect.error.message}
        </p>
      )}
    </>
  );
}
