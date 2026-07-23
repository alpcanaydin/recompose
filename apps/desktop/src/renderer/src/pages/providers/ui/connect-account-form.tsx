import type { IpcRequest } from '@recompose/contracts';
import type { SubmitEvent } from 'react';

import { useState } from 'react';

import { useConnectAccount } from '../api/accounts';
import { AccountKindField } from './account-kind-field';
import { TextField } from './text-field';

const emptyDraft: IpcRequest<'accounts:connect'> = {
  provider: '',
  kind: 'api-key',
  label: '',
  secret: '',
};

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
      <form onSubmit={handleSubmit}>
        <TextField
          label="Provider"
          value={draft.provider}
          onChangeValue={(provider) => {
            setDraft({ ...draft, provider });
          }}
        />
        <AccountKindField
          value={draft.kind}
          onChangeValue={(kind) => {
            setDraft({ ...draft, kind });
          }}
        />
        <TextField
          label="Label"
          value={draft.label}
          onChangeValue={(label) => {
            setDraft({ ...draft, label });
          }}
        />
        <TextField
          label="Secret"
          type="password"
          value={draft.secret}
          onChangeValue={(secret) => {
            setDraft({ ...draft, secret });
          }}
        />
        <button type="submit">Connect</button>
      </form>
      {connect.error === null ? null : <p role="alert">{connect.error.message}</p>}
    </>
  );
}
