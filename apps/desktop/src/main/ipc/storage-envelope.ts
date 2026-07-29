import type { IpcError } from '@recompose/contracts';

import { loadVaultFile, VaultNewerSchemaError } from '../storage/vault';

const unexplained = 'storage operation failed';

export function ipcFailure(code: IpcError['code'], message: string) {
  return { ok: false as const, error: { code, message: message === '' ? unexplained : message } };
}

export function storageFailure(error: unknown) {
  return ipcFailure('storage-failed', error instanceof Error ? error.message : unexplained);
}

export async function openVault(vaultFile: string, onCorrupt: (quarantinedPath: string) => void) {
  try {
    return { ok: true as const, vault: await loadVaultFile(vaultFile, onCorrupt) };
  } catch (error) {
    if (error instanceof VaultNewerSchemaError) {
      return ipcFailure('vault-newer-schema', error.message);
    }

    return storageFailure(error);
  }
}
