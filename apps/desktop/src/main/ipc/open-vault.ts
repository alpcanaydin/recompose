import type { StorageIpcContext, StoragePaths } from './storage-context';

import { loadVaultFile, VaultNewerSchemaError } from '../storage/vault';
import { withoutHome } from '../system/home-relative';
import { ipcFailure, storageFailure } from './storage-envelope';

/**
 * The one module a handler reaches the vault through.
 *
 * @summary Every path that opens the vault converges here, so a handler holding no credential is a
 * module away from the file that holds them all and the boundary is a rule rather than a habit.
 */
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

export async function openVaultForWrite(ctx: StorageIpcContext, paths: StoragePaths) {
  if (!ctx.isEncryptionAvailable()) {
    return ipcFailure('vault-unavailable', 'OS secret encryption is unavailable');
  }

  return openVault(paths.vaultFile, ctx.onCorrupt, ctx.homeFolder);
}
