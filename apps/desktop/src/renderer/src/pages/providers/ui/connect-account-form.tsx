import type { IpcRequest } from '@recompose/contracts';
import type { SubmitEvent } from 'react';

import { useState } from 'react';

import { TextField } from '../../../shared/ui/text-field';
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
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        {textEntries.map(({ field, label, type }) => (
          <div className="flex flex-col gap-1" key={field}>
            <span className="text-body text-ink">{label}</span>
            <TextField
              label={label}
              onChangeValue={(next) => {
                setDraft({ ...draft, [field]: next });
              }}
              type={type}
              value={draft[field]}
            />
          </div>
        ))}
        <AccountKindField
          onChangeValue={(kind) => {
            setDraft({ ...draft, kind });
          }}
          value={draft.kind}
        />
        <button type="submit">Connect</button>
      </form>
      {connect.error === null ? null : <p role="alert">{connect.error.message}</p>}
    </>
  );
}
