import type { AccountsDocument, CredentialedAccount, IpcRequest } from '@recompose/contracts';

import { keyTail } from '@recompose/contracts';
import { randomUUID } from 'node:crypto';

import type { StorageIpcContext, StoragePaths } from './storage-context';

import { amendAccountsFile, loadAccountsFile } from '../storage/accounts-store';
import { saveVaultFile, setSecret, type VaultDocument } from '../storage/vault';
import { openVaultForWrite } from './storage-context';
import { ipcFailure, storageFailure } from './storage-envelope';

type ConnectRequest = IpcRequest<'accounts:connect'>;

function nameHolderUnder(accounts: AccountsDocument, request: ConnectRequest) {
  return accounts.accounts.find(
    (held): held is CredentialedAccount =>
      (held.kind === 'api-key' || held.kind === 'aggregator') &&
      held.provider === request.provider &&
      held.label === request.label,
  );
}

async function refuseHeldName(
  ctx: StorageIpcContext,
  paths: StoragePaths,
  request: ConnectRequest,
) {
  const stored = await loadAccountsFile(paths.accountsFile, ctx.onCorrupt);
  const holder = nameHolderUnder(stored, request);

  if (holder === undefined) {
    return null;
  }

  return ipcFailure(
    'name-conflict',
    `Another ${request.provider} account already holds the name "${holder.label}".`,
  );
}

async function storeConnectedAccount(
  ctx: StorageIpcContext,
  paths: StoragePaths,
  request: ConnectRequest,
  vault: VaultDocument,
) {
  const credentialRef = `cred-${randomUUID()}`;
  const tail = keyTail(request.secret);
  const account = {
    id: `acc-${randomUUID()}`,
    provider: request.provider,
    kind: request.kind,
    label: request.label,
    credentialRef,
    ...(tail === undefined ? {} : { keyTail: tail }),
  };

  await saveVaultFile(
    paths.vaultFile,
    setSecret(vault, ctx.getCodec(), credentialRef, request.secret),
  );

  return amendAccountsFile(paths.accountsFile, ctx.onCorrupt, (accounts) => ({
    ...accounts,
    accounts: [...accounts.accounts, account],
  }));
}

export async function connectAccount(
  ctx: StorageIpcContext,
  paths: StoragePaths,
  request: ConnectRequest,
) {
  try {
    const refused = await refuseHeldName(ctx, paths, request);

    if (refused !== null) {
      return refused;
    }

    const opened = await openVaultForWrite(ctx, paths);

    if (!opened.ok) {
      return opened;
    }

    const updated = await storeConnectedAccount(ctx, paths, request, opened.vault);

    return { ok: true as const, value: updated };
  } catch (error) {
    return storageFailure(error, ctx.homeFolder);
  }
}
