import type { IpcError } from '@recompose/contracts';

import { AccountsNewerSchemaError } from '../storage/accounts-store';
import { loadVaultFile, VaultNewerSchemaError } from '../storage/vault';
import { withoutHome } from '../system/home-relative';

const unexplained = 'storage operation failed';

export function ipcFailure(code: IpcError['code'], message: string) {
  return { ok: false as const, error: { code, message: message === '' ? unexplained : message } };
}

/**
 * A storage failure on its way to the screen.
 *
 * @summary Node names the file it could not touch, absolute path and account name included, so the
 * home directory is written as the shorthand before the message leaves the main process.
 *
 * Every handler that reads accounts.json converges here, so the refusal that names a newer document
 * is told apart from ordinary storage trouble in the one place all of them pass through.
 */
export function storageFailure(error: unknown, home: string) {
  const reason = error instanceof Error ? error.message : unexplained;

  if (error instanceof AccountsNewerSchemaError) {
    return ipcFailure('accounts-newer-schema', withoutHome(reason, home));
  }

  return ipcFailure('storage-failed', withoutHome(reason, home));
}

export async function openVault(
  vaultFile: string,
  onCorrupt: (quarantinedPath: string) => void,
  home: string,
) {
  try {
    return { ok: true as const, vault: await loadVaultFile(vaultFile, onCorrupt) };
  } catch (error) {
    if (error instanceof VaultNewerSchemaError) {
      return ipcFailure('vault-newer-schema', withoutHome(error.message, home));
    }

    return storageFailure(error, home);
  }
}
