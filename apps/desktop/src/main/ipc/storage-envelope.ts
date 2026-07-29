import type { IpcError } from '@recompose/contracts';

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
 */
export function storageFailure(error: unknown, home: string) {
  const reason = error instanceof Error ? error.message : unexplained;

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
