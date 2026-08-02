import type { AccountsDocument } from '@recompose/contracts';

import { useRemoveAccount } from '../../../shared/api';

type AccountListProps = {
  accounts: AccountsDocument['accounts'];
};

/** Connected accounts with their remove affordances. */
export function AccountList({ accounts }: AccountListProps) {
  const remove = useRemoveAccount();

  return (
    <>
      <ul className="flex flex-col gap-2">
        {accounts.map((account) => (
          <li
            className="flex min-h-row items-center justify-between gap-5 rounded-card border border-line-subtle bg-surface-card px-4 py-2.5"
            key={account.id}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-body text-ink">{account.label}</span>
              <span className="text-detail text-ink-secondary">
                {account.provider} · {account.kind}
              </span>
            </div>
            <button
              className="push-button focus-ring"
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
      {remove.error === null ? null : (
        <p className="text-detail text-danger-ink" role="alert">
          {remove.error.message}
        </p>
      )}
    </>
  );
}
