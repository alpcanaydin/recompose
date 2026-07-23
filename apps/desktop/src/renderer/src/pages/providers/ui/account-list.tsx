import type { AccountsDocument } from '@recompose/contracts';

import { useRemoveAccount } from '../api/accounts';

type AccountListProps = {
  accounts: AccountsDocument['accounts'];
};

export function AccountList({ accounts }: AccountListProps) {
  const remove = useRemoveAccount();

  return (
    <ul>
      {accounts.map((account) => (
        <li key={account.id}>
          <span>{account.label}</span>
          <span>
            {account.provider} · {account.kind}
          </span>
          <button
            type="button"
            onClick={() => {
              remove.mutate({ id: account.id });
            }}
          >
            Remove {account.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
